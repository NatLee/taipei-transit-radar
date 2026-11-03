// Fares for one ride. A fare is a range so the app can be honest when the data can't
// pin it down (e.g. a two-segment bus whose buffer-zone names don't match its stop list).

import type { BusFare, MetroData } from '../data/schema.ts';

export interface Fare {
  min: number;
  max: number;
}

export const ZERO_FARE: Fare = { min: 0, max: 0 };

export const addFares = (a: Fare | null, b: Fare | null): Fare | null =>
  a && b ? { min: a.min + b.min, max: a.max + b.max } : null;

export function metroFare(data: MetroData, from: number, to: number): Fare | null {
  const v = data.fares[from * data.stations.length + to];
  return v === null || v === undefined ? null : { min: v, max: v };
}

/**
 * Taipei joint-bus segment fares: a ride costs one more segment for every buffer zone it
 * passes completely (boarding before the zone and alighting after it). Riding into or out of
 * a buffer zone stays within one segment.
 */
export function busFare(
  fare: BusFare,
  stopNames: readonly string[],
  board: number,
  alight: number,
  perSegment: number,
): Fare | null {
  if (fare.kind === 'free') return { min: 0, max: 0 };
  if (fare.kind === 'unknown') return null;
  const full = { min: perSegment, max: perSegment * fare.segments };
  if (fare.segments === 1) return { min: perSegment, max: perSegment };
  if (fare.buffers.length !== fare.segments - 1) return full;
  const strip = (s: string) => s.replace(/站$/, '').replace(/^捷運/, '');
  const names = stopNames.map(strip);
  let segments = 1;
  for (const [a, b] of fare.buffers) {
    const ia = names.indexOf(strip(a));
    const ib = names.indexOf(strip(b));
    if (ia < 0 || ib < 0) return full;
    const lo = Math.min(ia, ib);
    const hi = Math.max(ia, ib);
    const [from, to] = board < alight ? [board, alight] : [alight, board];
    if (from < lo && to > hi) segments++;
  }
  return { min: perSegment * segments, max: perSegment * segments };
}

export interface YoubikeTariff {
  freeMin: number;
  blockMin: number;
  perBlock: number;
}

/** YouBike 2.0 (Taipei): free for the first block, then a flat price per started block. */
export function youbikeFare(minutes: number, t: YoubikeTariff): Fare {
  if (minutes <= t.freeMin) return { min: 0, max: 0 };
  const paid = Math.ceil((minutes - t.freeMin) / t.blockMin) * t.perBlock;
  return { min: paid, max: paid };
}

export function formatFare(f: Fare | null): string {
  if (!f) return '票價未知';
  if (f.max === 0) return '免費';
  return f.min === f.max ? `NT$${f.min}` : `NT$${f.min}–${f.max}`;
}
