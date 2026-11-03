// Turns the Taipei e-bus GetRoute + GetStop feeds into the compact BusData file.

import { SCHEMA_VERSION, type BusData, type BusFare, type BusHeadway, type BusRoute, type BusStop } from './schema.ts';
import { round } from '../lib/geo.ts';

export interface RawBusRoute {
  Id: number;
  nameZh: string;
  providerName: string;
  departureZh: string;
  destinationZh: string;
  peakHeadway: string;
  offPeakHeadway: string;
  holidayPeakHeadway: string;
  holidayOffPeakHeadway: string;
  segmentBufferZh: string;
  ticketPriceDescriptionZh: string;
}

export interface RawBusStop {
  Id: number;
  routeId: number;
  nameZh: string;
  seqNo: number;
  goBack: string;
  latitude: string;
  longitude: string;
  stopLocationId: number;
}

export interface RawFeed<T> {
  EssentialInfo?: { UpdateTime?: string };
  BusInfo: T[];
}

export const BUS_ATTRIBUTION = '臺北市政府交通局 臺北市公車動態資訊（政府資料開放授權條款－第1版）';

/** "0510" → [5, 10]. Anything else (blank, "0000", odd lengths) → null. */
export function parseHeadway(raw: string | undefined): [number, number] | null {
  const m = /^(\d{2})(\d{2})$/.exec((raw ?? '').trim());
  if (!m) return null;
  const lo = Number(m[1]);
  const hi = Number(m[2]);
  if (lo === 0 && hi === 0) return null;
  return [Math.min(lo, hi) || Math.max(lo, hi), Math.max(lo, hi)];
}

const SEGMENT_WORDS: Record<string, number> = { 一: 1, 二: 2, 兩: 2, 三: 3, 四: 4 };

/**
 * Reads the free-text fare fields. Buffer zones are pairs of stop names ("景美女中-石壁坑",
 * several separated by 、 or ;). They're kept as text; the planner decides per trip whether a
 * ride crosses one and falls back to a fare range when the names don't match the stop list.
 */
export function parseFare(description: string, buffers: string): BusFare {
  const desc = description.trim();
  if (desc === '免費') return { kind: 'free' };
  const m = /^([一二兩三四])段票$/.exec(desc);
  if (!m) return { kind: 'unknown', note: desc || '未提供票價' };
  const segments = SEGMENT_WORDS[m[1]!]!;
  const pairs = buffers
    .split(/[、;；,，]/)
    .map((part) => part.split(/[-－–]/).map((s) => s.trim()))
    .filter((p): p is [string, string] => p.length === 2 && !!p[0] && !!p[1]);
  return { kind: 'segments', segments, buffers: pairs };
}

export function transformBus(
  routesFeed: RawFeed<RawBusRoute>,
  stopsFeed: RawFeed<RawBusStop>,
  generatedAt: string,
): BusData {
  // One physical pole (stopLocationId) is shared by every route that stops there.
  const stops: BusStop[] = [];
  const stopIndex = new Map<number, number>();
  for (const s of stopsFeed.BusInfo) {
    if (stopIndex.has(s.stopLocationId)) continue;
    const lat = Number(s.latitude);
    const lon = Number(s.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat === 0 || lon === 0) continue;
    stopIndex.set(s.stopLocationId, stops.length);
    stops.push({ id: s.stopLocationId, name: s.nameZh.trim(), lat: round(lat, 6), lon: round(lon, 6) });
  }

  const byRoute = new Map<number, RawBusStop[]>();
  for (const s of stopsFeed.BusInfo) {
    if (!stopIndex.has(s.stopLocationId)) continue;
    const list = byRoute.get(s.routeId);
    if (list) list.push(s);
    else byRoute.set(s.routeId, [s]);
  }

  const routes: BusRoute[] = [];
  const seen = new Set<number>();
  for (const r of routesFeed.BusInfo) {
    const routeStops = byRoute.get(r.Id);
    // GetRoute repeats a route once per path variant; its stops are listed once per route id.
    if (!routeStops || seen.has(r.Id)) continue;
    seen.add(r.Id);
    const dirs = [...new Set(routeStops.map((s) => Number(s.goBack)))].sort();
    const patterns = dirs
      .map((dir) => {
        const seq = routeStops.filter((s) => Number(s.goBack) === dir).sort((a, b) => a.seqNo - b.seqNo);
        return {
          dir,
          stops: seq.map((s) => stopIndex.get(s.stopLocationId)!),
          etaIds: seq.map((s) => s.Id),
        };
      })
      .filter((p) => p.stops.length >= 2);
    if (!patterns.length) continue;
    const headway: BusHeadway = {
      peak: parseHeadway(r.peakHeadway),
      offPeak: parseHeadway(r.offPeakHeadway),
      holidayPeak: parseHeadway(r.holidayPeakHeadway),
      holidayOffPeak: parseHeadway(r.holidayOffPeakHeadway),
    };
    routes.push({
      id: r.Id,
      name: r.nameZh.trim(),
      from: r.departureZh.trim(),
      to: r.destinationZh.trim(),
      operator: r.providerName.trim(),
      fare: parseFare(r.ticketPriceDescriptionZh, r.segmentBufferZh),
      headway,
      patterns,
    });
  }

  return {
    version: SCHEMA_VERSION,
    generatedAt,
    sourceUpdatedAt: routesFeed.EssentialInfo?.UpdateTime ?? '',
    attribution: [BUS_ATTRIBUTION],
    stops,
    routes,
  };
}
