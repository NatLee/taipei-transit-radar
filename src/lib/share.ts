// The query lives in the URL so a search can be shared: ?from=…&to=…&by=time
// A place is written as an MRT station code ("BL12"), a bus pole ("bus:3698") or
// coordinates ("25.04780,121.51700"), optionally followed by "~label".

import type { Priority } from './rank.ts';

export type PlaceRef =
  | { kind: 'station'; id: string }
  | { kind: 'busStop'; id: number }
  | { kind: 'point'; lat: number; lon: number; label?: string };

export interface ShareState {
  from: PlaceRef | null;
  to: PlaceRef | null;
  by: Priority;
}

const PRIORITY_IDS: readonly Priority[] = ['time', 'money', 'distance'];
const COORD = /^(-?\d{1,3}(?:\.\d+)?),(-?\d{1,3}(?:\.\d+)?)(?:~(.*))?$/;

export function encodePlace(p: PlaceRef): string {
  if (p.kind === 'station') return p.id;
  if (p.kind === 'busStop') return `bus:${p.id}`;
  const base = `${p.lat.toFixed(5)},${p.lon.toFixed(5)}`;
  return p.label ? `${base}~${p.label}` : base;
}

export function decodePlace(raw: string | null): PlaceRef | null {
  if (!raw) return null;
  const v = raw.trim();
  const coord = COORD.exec(v);
  if (coord) {
    const lat = Number(coord[1]);
    const lon = Number(coord[2]);
    if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
    return coord[3] ? { kind: 'point', lat, lon, label: coord[3] } : { kind: 'point', lat, lon };
  }
  const bus = /^bus:(\d+)$/.exec(v);
  if (bus) return { kind: 'busStop', id: Number(bus[1]) };
  if (/^[A-Z]{1,2}\d{1,2}[A-Z]?$/.test(v)) return { kind: 'station', id: v };
  return null;
}

export function readShareState(search: string, fallback: Priority = 'time'): ShareState {
  const q = new URLSearchParams(search);
  const by = q.get('by');
  return {
    from: decodePlace(q.get('from')),
    to: decodePlace(q.get('to')),
    by: PRIORITY_IDS.includes(by as Priority) ? (by as Priority) : fallback,
  };
}

export function writeShareState(s: ShareState): string {
  const q = new URLSearchParams();
  if (s.from) q.set('from', encodePlace(s.from));
  if (s.to) q.set('to', encodePlace(s.to));
  if (s.by !== 'time') q.set('by', s.by);
  const str = q.toString();
  return str ? `?${str}` : '';
}
