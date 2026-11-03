import { describe, expect, it } from 'vitest';
import { at, busFixture, metroFixture } from '../test/fixtures.ts';
import { buildNetwork } from './network.ts';
import { kcal, makeWaitFn, planTrips, walkOption, youbikeOption, type Dock, type PlanSettings, type RideStep } from './plan.ts';
import { findJourney } from './router.ts';

// Round numbers so expected values are easy to check by hand.
const S: PlanSettings = {
  walkMPerMin: 80,
  walkDetour: 1,
  walkReluctance: 1,
  boardPenaltyMin: 0,
  accessRadiusM: 600,
  metroKmh: 30, // 1 km = 2 min
  busKmh: 15, // 1 km = 4 min
  metroAccessMin: 2,
  busPeakHours: [],
  busFallbackHeadwayMin: 10,
  busFarePerSegment: 15,
  bikeKmh: 12,
  bikeDockMin: 2,
  youbike: { freeMin: 30, blockMin: 30, perBlock: 10 },
  youbikeDockRadiusM: 500,
  weightKg: 60,
  walkMet: 3.5,
  bikeMet: 6.8,
};
const NOON = { minute: 12 * 60, holiday: false };
const net = buildNetwork(metroFixture(), busFixture(), { transferRadiusM: 300, busDetour: 1 });
const rides = (steps: { kind: string }[]) => steps.filter((s): s is RideStep => s.kind === 'ride');

describe('findJourney', () => {
  it('rides the MRT from 甲 to 丙 with the expected time', () => {
    const wait = makeWaitFn(net, NOON, S, null);
    const j = findJourney(net, { origin: at(0, 0), destination: at(2, 0), modes: new Set(['metro']), wait }, S)!;
    // 2 min to the platform + 3 min average wait (6-min headway) + 2 km at 30 km/h (4 min).
    expect(j.minutes).toBeCloseTo(9, 5);
    expect(j.legs).toHaveLength(1);
  });

  it('returns null when the allowed modes cannot reach the destination', () => {
    const wait = makeWaitFn(net, NOON, S, null);
    // The bus does not go anywhere near 甲 → 丙 within the walking radius.
    expect(findJourney(net, { origin: at(0, 0), destination: at(2, 0), modes: new Set(['bus']), wait }, S)).toBeNull();
  });
});

describe('makeWaitFn', () => {
  it('uses the live arrival when the bus will still come after we reach the stop', () => {
    const ride = net.patterns.find((p) => p.mode === 'bus')!.offset; // route 9 at P, eta id 9001
    const wait = makeWaitFn(net, NOON, S, new Map([[9001, 600]]));
    expect(wait(ride, 4)).toEqual({ minutes: 6, source: 'live' });
    // Arriving after that bus has left: back to the headway estimate (10–20 → 7.5 min).
    expect(wait(ride, 12)).toEqual({ minutes: 7.5, source: 'timetable' });
  });

  it('treats "last bus gone" and "not stopping" as no service', () => {
    const ride = net.patterns.find((p) => p.mode === 'bus')!.offset;
    for (const code of [-2, -3, -4]) expect(makeWaitFn(net, NOON, S, new Map([[9001, code]]))(ride, 0).minutes).toBe(Infinity);
    // -1 (not departed yet) says nothing about when: keep the estimate.
    expect(makeWaitFn(net, NOON, S, new Map([[9001, -1]]))(ride, 0).source).toBe('timetable');
  });
});

describe('planTrips', () => {
  it('finds the bus → MRT transfer when neither alone gets there', () => {
    // From near P (north) to 丙 (east end of the MRT): bus P → R, walk to 乙, MRT 乙 → 丙.
    // Bus alone ends ~1 km from 丙 and the MRT is ~2 km from P, both beyond the 600 m walk radius.
    const options = planTrips(
      net,
      { origin: { ...at(1, 2.05), name: '起點' }, destination: { ...at(2, 0.05), name: '終點' }, clock: NOON },
      S,
    );
    expect(options.map((o) => o.kind)).toEqual(['walk', 'mixed']);
    const mixed = options.find((o) => o.kind === 'mixed')!;
    expect(rides(mixed.steps).map((r) => `${r.mode}:${r.name}`)).toEqual(['bus:9', 'metro:測試線']);
    // Bus NT$15 + MRT 乙 → 丙 NT$20.
    expect(mixed.fare).toEqual({ min: 35, max: 35 });
    expect(rides(mixed.steps)[0]!.headsign).toBe('S');
  });

  it('charges the MRT fare by entry and exit station', () => {
    const options = planTrips(
      net,
      { origin: { ...at(0, 0), name: '甲' }, destination: { ...at(2, 0), name: '丙' }, clock: NOON },
      S,
    );
    const metro = options.find((o) => o.kind === 'metro')!;
    expect(metro.fare).toEqual({ min: 25, max: 25 });
    expect(metro.live).toBe(false);
  });

  it('adds a YouBike option from live docks', () => {
    const docks: Dock[] = [
      { id: 'a', name: '起點站', ...at(0, 0.1), bikes: 3, slots: 0 },
      { id: 'b', name: '終點站', ...at(2, 0.1), bikes: 0, slots: 5 },
    ];
    const options = planTrips(
      net,
      { origin: { ...at(0, 0), name: '甲' }, destination: { ...at(2, 0), name: '丙' }, clock: NOON, docks },
      S,
    );
    const bike = options.find((o) => o.kind === 'youbike')!;
    expect(bike.steps.map((s) => s.kind)).toEqual(['walk', 'bike', 'walk']);
    expect(bike.fare).toEqual({ min: 0, max: 0 }); // 2 km at 12 km/h = 10 min, inside the free half hour
    expect(bike.live).toBe(true);
  });
});

describe('simple options', () => {
  it('walks the straight-line distance and counts calories for 60 kg', () => {
    const w = walkOption({ ...at(0, 0), name: 'a' }, { ...at(0, 0.8), name: 'b' }, S);
    expect(w.minutes).toBeCloseTo(10, 0); // 800 m at 80 m/min
    expect(w.kcal).toBeCloseTo(kcal(w.minutes, 3.5, 60), 6);
    expect(w.fare).toEqual({ min: 0, max: 0 });
  });

  it('skips YouBike when no dock with bikes is close enough', () => {
    const docks: Dock[] = [{ id: 'x', name: 'x', ...at(0, 0.1), bikes: 0, slots: 9 }];
    expect(youbikeOption({ ...at(0, 0), name: 'a' }, { ...at(2, 0), name: 'b' }, docks, S)).toBeNull();
  });
});
