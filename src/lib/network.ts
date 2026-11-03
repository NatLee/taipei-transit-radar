// The routing network: every MRT station and bus pole becomes a "stop", every service pattern
// (one direction of a metro line or bus route) becomes a run of "ride nodes", one per stop
// it calls at. Walking links connect stops that are close together.

import type { BusData, MetroData } from '../data/schema.ts';
import { distanceM, SpatialGrid, type Point } from './geo.ts';

export type Mode = 'metro' | 'bus';

export interface NetStop extends Point {
  name: string;
  kind: Mode;
  /** Index into metro.stations or bus.stops. */
  ref: number;
}

export interface RidePattern {
  mode: Mode;
  /** metro: index into metro.lines; bus: index into bus.routes. */
  owner: number;
  /** Index into metro.patterns or into the route's patterns. */
  source: number;
  stops: number[];
  segKm: number[];
  /** Ride-node id of the first stop; the node for position i is offset + i. */
  offset: number;
}

export interface NetworkOptions {
  transferRadiusM: number;
  busDetour: number;
}

export interface Network {
  metro: MetroData;
  bus: BusData | null;
  stops: NetStop[];
  grid: SpatialGrid<NetStop>;
  patterns: RidePattern[];
  rideCount: number;
  ridePattern: Int32Array;
  ridePos: Int32Array;
  /** Ride nodes you can board at each stop (every position except a pattern's last). */
  boardAt: number[][];
  /** Walking links between stops, compressed: links of stop s are in [walkStart[s], walkStart[s+1]). */
  walkStart: Int32Array;
  walkTo: Int32Array;
  walkM: Float32Array;
  stopOfStation: Int32Array;
  stopOfBusStop: Int32Array;
}

export function buildNetwork(metro: MetroData, bus: BusData | null, opts: NetworkOptions): Network {
  const stops: NetStop[] = [];
  const stopOfStation = new Int32Array(metro.stations.length);
  metro.stations.forEach((s, i) => {
    stopOfStation[i] = stops.length;
    stops.push({ lat: s.lat, lon: s.lon, name: s.name, kind: 'metro', ref: i });
  });
  const stopOfBusStop = new Int32Array(bus?.stops.length ?? 0);
  bus?.stops.forEach((s, i) => {
    stopOfBusStop[i] = stops.length;
    stops.push({ lat: s.lat, lon: s.lon, name: s.name, kind: 'bus', ref: i });
  });

  const patterns: RidePattern[] = [];
  let offset = 0;
  const lineIndex = new Map(metro.lines.map((l, i) => [l.code, i]));
  metro.patterns.forEach((p, source) => {
    const owner = lineIndex.get(p.line);
    if (owner === undefined) return;
    patterns.push({
      mode: 'metro',
      owner,
      source,
      stops: p.stations.map((s) => stopOfStation[s]!),
      segKm: p.km,
      offset,
    });
    offset += p.stations.length;
  });
  bus?.routes.forEach((route, owner) =>
    route.patterns.forEach((p, source) => {
      const ids = p.stops.map((s) => stopOfBusStop[s]!);
      const segKm = ids.slice(1).map((b, i) => (distanceM(stops[ids[i]!]!, stops[b]!) * opts.busDetour) / 1000);
      patterns.push({ mode: 'bus', owner, source, stops: ids, segKm, offset });
      offset += ids.length;
    }),
  );

  const ridePattern = new Int32Array(offset);
  const ridePos = new Int32Array(offset);
  const boardAt: number[][] = stops.map(() => []);
  patterns.forEach((p, pi) =>
    p.stops.forEach((s, i) => {
      ridePattern[p.offset + i] = pi;
      ridePos[p.offset + i] = i;
      if (i < p.stops.length - 1) boardAt[s]!.push(p.offset + i);
    }),
  );

  const grid = new SpatialGrid(stops, Math.max(100, opts.transferRadiusM));
  const walkStart = new Int32Array(stops.length + 1);
  const to: number[] = [];
  const meters: number[] = [];
  stops.forEach((s, i) => {
    walkStart[i] = to.length;
    for (const near of grid.within(s, opts.transferRadiusM)) {
      if (near.index === i) continue;
      to.push(near.index);
      meters.push(near.distanceM);
    }
  });
  walkStart[stops.length] = to.length;

  return {
    metro,
    bus,
    stops,
    grid,
    patterns,
    rideCount: offset,
    ridePattern,
    ridePos,
    boardAt,
    walkStart,
    walkTo: Int32Array.from(to),
    walkM: Float32Array.from(meters),
    stopOfStation,
    stopOfBusStop,
  };
}

/** Stop names along a pattern; the bus fare rules match buffer zones by name. */
export function patternStopNames(net: Network, p: RidePattern): string[] {
  return p.stops.map((s) => net.stops[s]!.name);
}
