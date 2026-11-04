// Turns raw journeys into the options the page compares: walk, bus, MRT, MRT + bus, YouBike.
// This is the 2016 "幫我比一比" feature, with the data now coming from open data instead of
// Google Directions.

import type { BusData } from '../data/schema.ts';
import { addFares, busFare, metroFare, youbikeFare, ZERO_FARE, type Fare, type YoubikeTariff } from './fares.ts';
import { distanceM, type Point } from './geo.ts';
import { patternStopNames, type Mode, type Network } from './network.ts';
import { findJourney, walkMinutes, type Journey, type Place, type RouterParams, type WaitSource } from './router.ts';
import { busHeadway, metroHeadway, type Clock } from './schedule.ts';

export type OptionKind = 'walk' | 'bus' | 'metro' | 'mixed' | 'youbike';

export interface WalkStep {
  kind: 'walk';
  from: Place;
  to: Place;
  meters: number;
  minutes: number;
}

export interface RideStep {
  kind: 'ride';
  mode: Mode;
  name: string;
  color: string;
  headsign: string;
  from: Place;
  to: Place;
  path: Place[];
  stopCount: number;
  accessMin: number;
  waitMin: number;
  waitSource: WaitSource;
  rideMin: number;
  km: number;
}

export interface BikeStep {
  kind: 'bike';
  from: Place;
  to: Place;
  km: number;
  minutes: number;
  bikesAtStart: number;
  slotsAtEnd: number;
}

export type Step = WalkStep | RideStep | BikeStep;

export interface TripOption {
  kind: OptionKind;
  steps: Step[];
  minutes: number;
  km: number;
  fare: Fare | null;
  kcal: number;
  /** True when a live feed (bus arrivals, YouBike docks) shaped this option. */
  live: boolean;
}

export interface Dock extends Point {
  id: string;
  name: string;
  bikes: number;
  slots: number;
}

/** Live arrival per route-stop id: seconds until arrival, or a negative status code from the feed. */
export type BusEtas = ReadonlyMap<number, number>;

export interface PlanSettings extends RouterParams {
  busPeakHours: readonly (readonly [number, number])[];
  busFallbackHeadwayMin: number;
  busFarePerSegment: number;
  bikeKmh: number;
  bikeDockMin: number;
  youbike: YoubikeTariff;
  youbikeDockRadiusM: number;
  weightKg: number;
  walkMet: number;
  bikeMet: number;
}

export interface PlanInput {
  origin: Place;
  destination: Place;
  clock: Clock;
  busEtas?: BusEtas | null;
  docks?: readonly Dock[] | null;
}

/** Feed codes: -1 not departed yet, -2 skipped (traffic control), -3 last bus gone, -4 no service today. */
const NOT_STOPPING = new Set([-2, -3, -4]);

export function kcal(minutes: number, met: number, weightKg: number): number {
  return (met * weightKg * minutes) / 60;
}

export function makeWaitFn(net: Network, clock: Clock, s: PlanSettings, etas: BusEtas | null | undefined) {
  return (ride: number, elapsedMin: number): { minutes: number; source: WaitSource } => {
    const pat = net.patterns[net.ridePattern[ride]!]!;
    if (pat.mode === 'metro') {
      const h = metroHeadway(net.metro.lines[pat.owner]!, clock);
      return { minutes: h.minutes / 2, source: h.official ? 'timetable' : 'estimate' };
    }
    const route = (net.bus as BusData).routes[pat.owner]!;
    const etaId = route.patterns[pat.source]!.etaIds[net.ridePos[ride]!]!;
    const eta = etas?.get(etaId);
    if (eta !== undefined) {
      if (NOT_STOPPING.has(eta)) return { minutes: Infinity, source: 'live' };
      if (eta >= 0 && eta / 60 >= elapsedMin) return { minutes: eta / 60 - elapsedMin, source: 'live' };
    }
    const h = busHeadway(route.headway, clock, s.busPeakHours, s.busFallbackHeadwayMin);
    return { minutes: h.minutes / 2, source: h.official ? 'timetable' : 'estimate' };
  };
}

function describe(net: Network, journey: Journey, s: PlanSettings): { steps: Step[]; fare: Fare | null } {
  const steps: Step[] = [];
  let fare: Fare | null = ZERO_FARE;
  let metroTripStart: number | null = null;
  let metroTripEnd: number | null = null;
  const closeMetroTrip = () => {
    if (metroTripStart !== null && metroTripEnd !== null) {
      fare = addFares(fare, metroFare(net.metro, metroTripStart, metroTripEnd));
    }
    metroTripStart = metroTripEnd = null;
  };

  for (const leg of journey.legs) {
    if (leg.kind === 'walk') {
      closeMetroTrip();
      steps.push({ ...leg });
      continue;
    }
    const pat = net.patterns[leg.pattern]!;
    const path = pat.stops.slice(leg.board, leg.alight + 1).map((s) => ({ ...net.stops[s]!, name: net.stops[s]!.name }));
    const from = path[0]!;
    const to = path.at(-1)!;
    let name: string;
    let color: string;
    let headsign: string;
    if (pat.mode === 'metro') {
      const line = net.metro.lines[pat.owner]!;
      name = line.name;
      color = line.color;
      headsign = net.stops[pat.stops.at(-1)!]!.name;
      // Changing lines inside the paid area doesn't start a new fare.
      const startStation = net.stops[pat.stops[leg.board]!]!.ref;
      if (metroTripStart === null) metroTripStart = startStation;
      metroTripEnd = net.stops[pat.stops[leg.alight]!]!.ref;
    } else {
      closeMetroTrip();
      const route = net.bus!.routes[pat.owner]!;
      const bp = route.patterns[pat.source]!;
      name = route.name;
      color = '';
      headsign = bp.dir === 1 ? route.from : route.to;
      fare = addFares(fare, busFare(route.fare, patternStopNames(net, pat), leg.board, leg.alight, s.busFarePerSegment));
    }
    steps.push({
      kind: 'ride',
      mode: pat.mode,
      name,
      color,
      headsign,
      from,
      to,
      path,
      stopCount: leg.alight - leg.board,
      accessMin: leg.accessMin,
      waitMin: leg.waitMin,
      waitSource: leg.waitSource,
      rideMin: leg.rideMin,
      km: leg.km,
    });
  }
  closeMetroTrip();
  return { steps, fare };
}

function summarize(kind: OptionKind, steps: Step[], fare: Fare | null, s: PlanSettings): TripOption {
  let minutes = 0;
  let km = 0;
  let burn = 0;
  let live = false;
  for (const st of steps) {
    if (st.kind === 'walk') {
      minutes += st.minutes;
      km += (st.meters * s.walkDetour) / 1000;
      burn += kcal(st.minutes, s.walkMet, s.weightKg);
    } else if (st.kind === 'bike') {
      minutes += st.minutes + s.bikeDockMin;
      km += st.km;
      burn += kcal(st.minutes, s.bikeMet, s.weightKg);
      live = true;
    } else {
      minutes += st.accessMin + st.waitMin + st.rideMin;
      km += st.km;
      if (st.waitSource === 'live') live = true;
    }
  }
  return { kind, steps, minutes, km, fare, kcal: burn, live };
}

export function walkOption(origin: Place, destination: Place, s: PlanSettings): TripOption {
  const meters = distanceM(origin, destination);
  const step: WalkStep = { kind: 'walk', from: origin, to: destination, meters, minutes: walkMinutes(meters, s) };
  return summarize('walk', [step], ZERO_FARE, s);
}

export function youbikeOption(
  origin: Place,
  destination: Place,
  docks: readonly Dock[],
  s: PlanSettings,
): TripOption | null {
  const near = (p: Point, ok: (d: Dock) => boolean) =>
    docks
      .filter(ok)
      .map((d) => ({ d, m: distanceM(p, d) }))
      .filter((x) => x.m <= s.youbikeDockRadiusM)
      .sort((a, b) => a.m - b.m)
      .slice(0, 3);
  const starts = near(origin, (d) => d.bikes > 0);
  const ends = near(destination, (d) => d.slots > 0);
  let best: TripOption | null = null;
  for (const a of starts) {
    for (const b of ends) {
      if (a.d.id === b.d.id) continue;
      const km = (distanceM(a.d, b.d) * s.walkDetour) / 1000;
      const rideMin = (km / s.bikeKmh) * 60;
      const steps: Step[] = [
        { kind: 'walk', from: origin, to: a.d, meters: a.m, minutes: walkMinutes(a.m, s) },
        { kind: 'bike', from: a.d, to: b.d, km, minutes: rideMin, bikesAtStart: a.d.bikes, slotsAtEnd: b.d.slots },
        { kind: 'walk', from: b.d, to: destination, meters: b.m, minutes: walkMinutes(b.m, s) },
      ];
      const opt = summarize('youbike', steps, youbikeFare(rideMin, s.youbike), s);
      if (!best || opt.minutes < best.minutes) best = opt;
    }
  }
  return best;
}

/** Same sequence of vehicles → same option, even if found by different searches. */
const signature = (o: TripOption) =>
  o.steps.map((st) => (st.kind === 'ride' ? `${st.mode}:${st.name}:${st.from.name}>${st.to.name}` : st.kind)).join('|');

export function planTrips(net: Network, input: PlanInput, s: PlanSettings): TripOption[] {
  const wait = makeWaitFn(net, input.clock, s, input.busEtas);
  const options: TripOption[] = [walkOption(input.origin, input.destination, s)];
  const searches: [OptionKind, Mode[]][] = [
    ['bus', ['bus']],
    ['metro', ['metro']],
    ['mixed', ['metro', 'bus']],
  ];
  const seen = new Set<string>();
  for (const [kind, modes] of searches) {
    if (modes.includes('bus') && !net.bus) continue;
    const journey = findJourney(
      net,
      { origin: input.origin, destination: input.destination, modes: new Set(modes), wait },
      s,
    );
    if (!journey) continue;
    const { steps, fare } = describe(net, journey, s);
    const usedModes = new Set(steps.flatMap((st) => (st.kind === 'ride' ? [st.mode] : [])));
    // A "mixed" result that only rides one kind of vehicle is already covered by that option.
    if (kind === 'mixed' && usedModes.size < 2) continue;
    const opt = summarize(kind, steps, fare, s);
    const sig = signature(opt);
    if (seen.has(sig)) continue;
    seen.add(sig);
    options.push(opt);
  }
  if (input.docks?.length) {
    const bike = youbikeOption(input.origin, input.destination, input.docks, s);
    if (bike) options.push(bike);
  }
  return options;
}
