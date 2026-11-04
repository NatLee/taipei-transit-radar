// Live feeds read straight from the browser: Taipei bus arrivals and YouBike docks.
// Both are public, key-less and allow cross-origin requests.

import type { BusEtas, Dock } from './plan.ts';

interface RawEstimate {
  StopID: number;
  EstimateTime: string;
}

interface RawDock {
  sno: string;
  sna: string;
  act: string;
  latitude: number;
  longitude: number;
  available_rent_bikes: number;
  available_return_bikes: number;
}

export function parseEstimates(feed: { BusInfo: RawEstimate[] }): Map<number, number> {
  const out = new Map<number, number>();
  for (const e of feed.BusInfo) {
    const v = Number(e.EstimateTime);
    if (Number.isFinite(v)) out.set(e.StopID, v);
  }
  return out;
}

/** "YouBike2.0_捷運科技大樓站" → "捷運科技大樓站". Inactive docks are dropped. */
export function parseDocks(rows: RawDock[]): Dock[] {
  return rows
    .filter((r) => r.act === '1' && Number.isFinite(r.latitude) && Number.isFinite(r.longitude))
    .map((r) => ({
      id: r.sno,
      name: r.sna.replace(/^YouBike\s*2\.0[_\s]*/i, ''),
      lat: r.latitude,
      lon: r.longitude,
      bikes: r.available_rent_bikes,
      slots: r.available_return_bikes,
    }));
}

/** Arrival label as riders read it on the e-bus signs. */
export function etaLabel(value: number | undefined): string {
  if (value === undefined) return '—';
  switch (value) {
    case -1:
      return '尚未發車';
    case -2:
      return '交管不停靠';
    case -3:
      return '末班車已過';
    case -4:
      return '今日未營運';
  }
  if (value < 0) return '—';
  if (value < 60) return '進站中';
  return `${Math.round(value / 60)} 分`;
}

async function gunzipJson<T>(res: Response): Promise<T> {
  const stream = res.body!.pipeThrough(new DecompressionStream('gzip'));
  const text = (await new Response(stream).text()).replace(/^\uFEFF/, '');
  return JSON.parse(text) as T;
}

/** Caches a fetch for `ttlMs` so panels and the planner share one request. */
export function cached<T>(load: () => Promise<T>, ttlMs: number) {
  let at = 0;
  let pending: Promise<T> | null = null;
  return (): Promise<T> => {
    if (!pending || Date.now() - at > ttlMs) {
      at = Date.now();
      pending = load().catch((err: unknown) => {
        pending = null;
        throw err;
      });
    }
    return pending;
  };
}

export async function fetchBusEtas(url: string): Promise<{ etas: BusEtas; updatedAt: string }> {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`公車動態 HTTP ${res.status}`);
  const feed = await gunzipJson<{ EssentialInfo?: { UpdateTime?: string }; BusInfo: RawEstimate[] }>(res);
  return { etas: parseEstimates(feed), updatedAt: feed.EssentialInfo?.UpdateTime ?? '' };
}

export async function fetchDocks(url: string): Promise<Dock[]> {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`YouBike HTTP ${res.status}`);
  return parseDocks((await res.json()) as RawDock[]);
}
