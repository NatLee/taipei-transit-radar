// Fastest journey through the network (Dijkstra over stops and ride nodes).
// Waiting time comes from a callback so live arrival data can replace the headway estimate.

import { distanceM, type Point } from './geo.ts';
import type { Mode, Network } from './network.ts';

export type WaitSource = 'live' | 'timetable' | 'estimate';

export interface RouterParams {
  walkMPerMin: number;
  walkDetour: number;
  walkReluctance: number;
  boardPenaltyMin: number;
  accessRadiusM: number;
  metroKmh: number;
  busKmh: number;
  metroAccessMin: number;
}

export interface SearchInput {
  origin: Point;
  destination: Point;
  modes: ReadonlySet<Mode>;
  /** Expected wait when boarding ride node `ride` after `elapsedMin` minutes of travel. */
  wait: (ride: number, elapsedMin: number) => { minutes: number; source: WaitSource };
}

export interface Place extends Point {
  name: string;
}

export interface WalkLeg {
  kind: 'walk';
  from: Place;
  to: Place;
  meters: number;
  minutes: number;
}

export interface RideLeg {
  kind: 'ride';
  mode: Mode;
  pattern: number;
  board: number;
  alight: number;
  /** Walking from the street (or another line) to the platform; metro only. */
  accessMin: number;
  waitMin: number;
  waitSource: WaitSource;
  rideMin: number;
  km: number;
}

export type Leg = WalkLeg | RideLeg;

export interface Journey {
  legs: Leg[];
  minutes: number;
}

/** How a node was reached; stored per node in an Int8Array. */
const Via = { None: 0, Walk: 1, Board: 2, Ride: 3, Alight: 4 } as const;
type Via = (typeof Via)[keyof typeof Via];

/** Binary min-heap of node ids keyed by a cost array. Stale entries are skipped by the caller. */
class Heap {
  private ids: number[] = [];
  private keys: number[] = [];
  get size() {
    return this.ids.length;
  }
  push(id: number, key: number) {
    const ids = this.ids;
    const keys = this.keys;
    let i = ids.length;
    ids.push(id);
    keys.push(key);
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (keys[parent]! <= key) break;
      ids[i] = ids[parent]!;
      keys[i] = keys[parent]!;
      i = parent;
    }
    ids[i] = id;
    keys[i] = key;
  }
  pop(): [id: number, key: number] {
    const ids = this.ids;
    const keys = this.keys;
    const top: [number, number] = [ids[0]!, keys[0]!];
    const lastId = ids.pop()!;
    const lastKey = keys.pop()!;
    const n = ids.length;
    if (n) {
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        if (l >= n) break;
        const r = l + 1;
        const c = r < n && keys[r]! < keys[l]! ? r : l;
        if (keys[c]! >= lastKey) break;
        ids[i] = ids[c]!;
        keys[i] = keys[c]!;
        i = c;
      }
      ids[i] = lastId;
      keys[i] = lastKey;
    }
    return top;
  }
}

export function walkMinutes(meters: number, p: Pick<RouterParams, 'walkMPerMin' | 'walkDetour'>): number {
  return (meters * p.walkDetour) / p.walkMPerMin;
}

export function findJourney(net: Network, input: SearchInput, p: RouterParams): Journey | null {
  const S = net.stops.length;
  const R = net.rideCount;
  const ORIGIN = S + R;
  const DEST = ORIGIN + 1;
  const N = DEST + 1;
  const cost = new Float64Array(N).fill(Infinity);
  const time = new Float64Array(N).fill(Infinity);
  const prev = new Int32Array(N).fill(-1);
  const via = new Int8Array(N);
  const waitMin = new Float32Array(R);
  const waitSrc: WaitSource[] = new Array(R);
  const done = new Uint8Array(N);
  const heap = new Heap();

  const destStops = new Map<number, number>();
  for (const near of net.grid.within(input.destination, p.accessRadiusM)) destStops.set(near.index, near.distanceM);

  const relax = (node: number, c: number, t: number, from: number, how: Via) => {
    if (c >= cost[node]!) return;
    cost[node] = c;
    time[node] = t;
    prev[node] = from;
    via[node] = how;
    heap.push(node, c);
  };

  const accessMin = (stop: number) => {
    const s = net.stops[stop]!;
    if (s.kind !== 'metro') return 0;
    return net.metro.stations[s.ref]!.transferMin ?? p.metroAccessMin;
  };

  const board = (stop: number, c: number, t: number, from: number) => {
    const access = accessMin(stop);
    for (const ride of net.boardAt[stop]!) {
      if (!input.modes.has(net.patterns[net.ridePattern[ride]!]!.mode)) continue;
      const w = input.wait(ride, t + access);
      const nc = c + access + w.minutes + p.boardPenaltyMin;
      if (nc < cost[S + ride]!) {
        waitMin[ride] = w.minutes;
        waitSrc[ride] = w.source;
      }
      relax(S + ride, nc, t + access + w.minutes, from, Via.Board);
    }
  };

  cost[ORIGIN] = 0;
  time[ORIGIN] = 0;
  heap.push(ORIGIN, 0);

  while (heap.size) {
    const [node, c] = heap.pop();
    if (done[node] || c > cost[node]!) continue;
    done[node] = 1;
    const t = time[node]!;
    if (node === DEST) break;

    if (node === ORIGIN) {
      for (const near of net.grid.within(input.origin, p.accessRadiusM)) {
        const m = walkMinutes(near.distanceM, p);
        board(near.index, m * p.walkReluctance, m, ORIGIN);
      }
    } else if (node >= S) {
      const ride = node - S;
      const pat = net.patterns[net.ridePattern[ride]!]!;
      const pos = net.ridePos[ride]!;
      const kmh = pat.mode === 'metro' ? p.metroKmh : p.busKmh;
      if (pos < pat.stops.length - 1) {
        const m = (pat.segKm[pos]! / kmh) * 60;
        relax(node + 1, c + m, t + m, node, Via.Ride);
      }
      if (pos > 0) relax(pat.stops[pos]!, c, t, node, Via.Alight);
    } else {
      // A stop, reached by getting off something.
      const stop = node;
      const toDest = destStops.get(stop);
      if (toDest !== undefined) {
        const m = walkMinutes(toDest, p);
        relax(DEST, c + m * p.walkReluctance, t + m, stop, Via.Walk);
      }
      board(stop, c, t, stop);
      if (via[stop] === Via.Alight) {
        for (let k = net.walkStart[stop]!; k < net.walkStart[stop + 1]!; k++) {
          const m = walkMinutes(net.walkM[k]!, p);
          relax(net.walkTo[k]!, c + m * p.walkReluctance, t + m, stop, Via.Walk);
        }
      }
    }
  }

  if (prev[DEST]! < 0) return null;

  // Walk the predecessor chain back from the destination, then build legs front to back.
  const path: number[] = [];
  for (let n = DEST; n >= 0; n = prev[n]!) path.push(n);
  path.reverse();

  const legs: Leg[] = [];
  const placeOfStop = (s: number): Place => ({ ...net.stops[s]!, name: net.stops[s]!.name });
  const origin: Place = { ...input.origin, name: '起點' };
  const destination: Place = { ...input.destination, name: '終點' };
  let current: RideLeg | null = null;
  for (let i = 1; i < path.length; i++) {
    const node = path[i]!;
    const from = path[i - 1]!;
    if (node === DEST) {
      const m = distanceM(net.stops[from]!, input.destination);
      if (m > 1) legs.push({ kind: 'walk', from: placeOfStop(from), to: destination, meters: m, minutes: walkMinutes(m, p) });
      continue;
    }
    if (node >= S) {
      const ride = node - S;
      const pat = net.patterns[net.ridePattern[ride]!]!;
      const pos = net.ridePos[ride]!;
      if (via[node] === Via.Board) {
        const stop = pat.stops[pos]!;
        const fromPlace = from === ORIGIN ? origin : placeOfStop(from);
        const m = distanceM(fromPlace, net.stops[stop]!);
        if (m > 1) legs.push({ kind: 'walk', from: fromPlace, to: placeOfStop(stop), meters: m, minutes: walkMinutes(m, p) });
        current = {
          kind: 'ride',
          mode: pat.mode,
          pattern: net.ridePattern[ride]!,
          board: pos,
          alight: pos,
          accessMin: accessMin(stop),
          waitMin: waitMin[ride]!,
          waitSource: waitSrc[ride] ?? 'estimate',
          rideMin: 0,
          km: 0,
        };
        legs.push(current);
      } else if (via[node] === Via.Ride && current) {
        const km = pat.segKm[pos - 1]!;
        current.alight = pos;
        current.km += km;
        current.rideMin += (km / (pat.mode === 'metro' ? p.metroKmh : p.busKmh)) * 60;
      }
      continue;
    }
    // node is a stop
    if (via[node] === Via.Walk) {
      const m = distanceM(net.stops[from]!, net.stops[node]!);
      legs.push({ kind: 'walk', from: placeOfStop(from), to: placeOfStop(node), meters: m, minutes: walkMinutes(m, p) });
    }
    current = null;
  }

  return { legs, minutes: time[DEST]! };
}
