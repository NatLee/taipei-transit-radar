// Local place search over MRT stations, bus stops and YouBike docks. Everything is already in
// the browser, so this needs no geocoding service.

import type { BusData, MetroData } from '../data/schema.ts';
import { distanceM, type Point } from './geo.ts';
import type { Dock } from './plan.ts';
import { stationLabel } from './places.ts';
import type { PlaceRef } from './share.ts';

export type PlaceKind = 'station' | 'busStop' | 'dock' | 'point';

export interface SearchEntry extends Point {
  kind: PlaceKind;
  name: string;
  detail: string;
  ref: PlaceRef;
  /** Normalised text the query is matched against. */
  key: string;
}

/** 臺 and 台 are used interchangeably; case and spaces don't matter. */
export function normalize(text: string): string {
  return text.replace(/臺/g, '台').replace(/\s+/g, '').toLowerCase();
}

/** Same-name bus poles within this distance are one place (both sides of a road, bays). */
const SAME_STOP_M = 350;

export function buildSearchIndex(metro: MetroData, bus: BusData | null, docks: readonly Dock[] = []): SearchEntry[] {
  const out: SearchEntry[] = metro.stations.map((s) => ({
    kind: 'station',
    name: s.name,
    detail: `捷運 ${s.codes.join('/')} · ${s.nameEn}`,
    lat: s.lat,
    lon: s.lon,
    ref: { kind: 'station', id: s.id },
    key: normalize(`${s.name} ${s.nameEn} ${s.codes.join(' ')} ${stationLabel(s.name)}`),
  }));

  if (bus) {
    const routesAt = new Map<number, Set<string>>();
    for (const r of bus.routes)
      for (const p of r.patterns)
        for (const s of p.stops) {
          const set = routesAt.get(s) ?? new Set<string>();
          set.add(r.name);
          routesAt.set(s, set);
        }
    const clusters: { name: string; members: number[] }[] = [];
    const byName = new Map<string, number[]>();
    bus.stops.forEach((s, i) => byName.set(s.name, [...(byName.get(s.name) ?? []), i]));
    for (const [name, idx] of byName) {
      const groups: number[][] = [];
      for (const i of idx) {
        const g = groups.find((grp) => distanceM(bus.stops[grp[0]!]!, bus.stops[i]!) <= SAME_STOP_M);
        if (g) g.push(i);
        else groups.push([i]);
      }
      for (const g of groups) clusters.push({ name, members: g });
    }
    for (const c of clusters) {
      const first = bus.stops[c.members[0]!]!;
      const routes = new Set(c.members.flatMap((i) => [...(routesAt.get(i) ?? [])]));
      out.push({
        kind: 'busStop',
        name: c.name,
        detail: `公車站 · ${routes.size} 條路線`,
        lat: first.lat,
        lon: first.lon,
        ref: { kind: 'busStop', id: first.id },
        key: normalize(c.name),
      });
    }
  }

  for (const d of docks) {
    out.push({
      kind: 'dock',
      name: d.name,
      detail: 'YouBike 站',
      lat: d.lat,
      lon: d.lon,
      ref: { kind: 'point', lat: d.lat, lon: d.lon, label: d.name },
      key: normalize(`youbike ${d.name}`),
    });
  }
  return out;
}

const KIND_ORDER: Record<PlaceKind, number> = { station: 0, busStop: 1, dock: 2, point: 3 };

export function search(index: readonly SearchEntry[], query: string, limit = 8): SearchEntry[] {
  const q = normalize(query);
  if (!q) return [];
  const scored: { e: SearchEntry; score: number }[] = [];
  for (const e of index) {
    const at = e.key.indexOf(q);
    if (at < 0) continue;
    const exact = normalize(e.name) === q ? 0 : 1;
    scored.push({ e, score: exact * 100 + (at === 0 ? 0 : 10) + KIND_ORDER[e.kind] * 3 + e.name.length * 0.1 });
  }
  return scored
    .sort((a, b) => a.score - b.score)
    .slice(0, limit)
    .map((s) => s.e);
}
