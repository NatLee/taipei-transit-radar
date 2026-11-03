// Resolving share-link references to places, and what is around a place (2016's "附近的站").

import { SCHEMA_VERSION, type BusData, type MetroData, type MetroStation } from '../data/schema.ts';
import { distanceM, type Point } from './geo.ts';
import type { Network } from './network.ts';
import type { BusEtas, Dock } from './plan.ts';
import type { Place } from './router.ts';
import type { PlaceRef } from './share.ts';

export interface ChosenPlace extends Place {
  ref: PlaceRef;
}

/** "台北車站" → "捷運台北車站", "北投" → "捷運北投站": the way the stations are signposted. */
export function stationLabel(name: string): string {
  return name.endsWith('站') ? `捷運${name}` : `捷運${name}站`;
}

export function resolvePlace(ref: PlaceRef, metro: MetroData, bus: BusData | null): ChosenPlace | null {
  if (ref.kind === 'point') return { lat: ref.lat, lon: ref.lon, name: ref.label ?? '地圖上的點', ref };
  if (ref.kind === 'station') {
    const s = metro.stations.find((x) => x.id === ref.id || x.codes.includes(ref.id));
    return s ? { lat: s.lat, lon: s.lon, name: stationLabel(s.name), ref: { kind: 'station', id: s.id } } : null;
  }
  const stop = bus?.stops.find((x) => x.id === ref.id);
  return stop ? { lat: stop.lat, lon: stop.lon, name: stop.name, ref } : null;
}

export function nearestStation(metro: MetroData, p: Point): { station: MetroStation; meters: number } | null {
  let best: { station: MetroStation; meters: number } | null = null;
  for (const station of metro.stations) {
    const meters = distanceM(p, station);
    if (!best || meters < best.meters) best = { station, meters };
  }
  return best;
}

export interface NearbyRoute {
  route: string;
  headsign: string;
  /** Seconds, or a negative feed status code; undefined when the live feed has no row. */
  eta: number | undefined;
}

export interface NearbyStop {
  name: string;
  meters: number;
  stopIndex: number;
  routes: NearbyRoute[];
}

export interface NearbyResult {
  stations: { station: MetroStation; meters: number }[];
  stops: NearbyStop[];
  docks: (Dock & { meters: number })[];
}

export function findNearby(
  net: Network,
  p: Point,
  radius: { station: number; stop: number; dock: number },
  etas: BusEtas | null,
  docks: readonly Dock[] | null,
): NearbyResult {
  const stations: NearbyResult['stations'] = [];
  const stops: NearbyStop[] = [];
  for (const near of net.grid.within(p, Math.max(radius.station, radius.stop))) {
    const s = net.stops[near.index]!;
    if (s.kind === 'metro') {
      if (near.distanceM <= radius.station)
        stations.push({ station: net.metro.stations[s.ref]!, meters: near.distanceM });
      continue;
    }
    if (near.distanceM > radius.stop || !net.bus) continue;
    const routes: NearbyRoute[] = [];
    for (const ride of net.boardAt[near.index]!) {
      const pat = net.patterns[net.ridePattern[ride]!]!;
      const route = net.bus.routes[pat.owner]!;
      const bp = route.patterns[pat.source]!;
      routes.push({
        route: route.name,
        headsign: bp.dir === 1 ? route.from : route.to,
        eta: etas?.get(bp.etaIds[net.ridePos[ride]!]!),
      });
    }
    if (!routes.length) continue;
    const order = (r: NearbyRoute) => (r.eta === undefined || r.eta < 0 ? Infinity : r.eta);
    routes.sort((a, b) => order(a) - order(b) || a.route.localeCompare(b.route, 'zh-Hant'));
    stops.push({ name: s.name, meters: near.distanceM, stopIndex: near.index, routes });
  }
  const nearDocks = (docks ?? [])
    .map((d) => ({ ...d, meters: distanceM(p, d) }))
    .filter((d) => d.meters <= radius.dock)
    .sort((a, b) => a.meters - b.meters);
  return { stations, stops, docks: nearDocks };
}

/** Fetches one of the static data files and checks that it matches this build. */
export async function loadData<T extends { version: number }>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  const data = (await res.json()) as T;
  if (data.version !== SCHEMA_VERSION) throw new Error(`${url}: data version ${data.version}, expected ${SCHEMA_VERSION}`);
  return data;
}
