// Shapes of the static JSON files in public/data/. The build scripts write them and the
// app reads them, so both sides import these types. Bump SCHEMA_VERSION when a field
// changes meaning; the app refuses files from another version instead of guessing.

export const SCHEMA_VERSION = 1;

export type LonLat = [lon: number, lat: number];

/** One service window from the Taipei Metro headway dataset, minutes since midnight. */
export interface HeadwayWindow {
  start: number;
  end: number;
  min: number;
  max: number;
}

export interface HeadwayTable {
  weekday: HeadwayWindow[];
  holiday: HeadwayWindow[];
}

export interface MetroStation {
  /** Lowest station code, e.g. "BL12". Stable across data refreshes; used in share links. */
  id: string;
  name: string;
  nameEn: string;
  codes: string[];
  lat: number;
  lon: number;
  lines: string[];
  /** Official walking time between platforms at a transfer station, minutes. */
  transferMin: number | null;
}

export interface MetroLine {
  code: string;
  name: string;
  nameEn: string;
  color: string;
  /** Parsed from the headway dataset; null when the dataset has no row for this line. */
  headways: HeadwayTable | null;
  /** Used when `headways` is null or has no window for the current time. */
  fallbackHeadwayMin: number;
  shape: LonLat[][];
}

/** One direction of one service pattern: an ordered list of station indexes. */
export interface MetroPattern {
  line: string;
  stations: number[];
  /** Track distance between consecutive stations, km (length = stations.length - 1). */
  km: number[];
}

export interface MetroData {
  version: typeof SCHEMA_VERSION;
  generatedAt: string;
  attribution: string[];
  stations: MetroStation[];
  lines: MetroLine[];
  patterns: MetroPattern[];
  /** Adult single-ticket fare from station i to j at index i * n + j; null when unknown. */
  fares: (number | null)[];
}

export interface BusStop {
  /** `stopLocationId` from the Taipei e-bus feed: one physical pole shared by routes. */
  id: number;
  name: string;
  lat: number;
  lon: number;
}

export type BusFare =
  | { kind: 'free' }
  | { kind: 'segments'; segments: number; buffers: [string, string][] }
  | { kind: 'unknown'; note: string };

/** Headway ranges in minutes, [shortest, longest]; null when the feed leaves them blank. */
export interface BusHeadway {
  peak: [number, number] | null;
  offPeak: [number, number] | null;
  holidayPeak: [number, number] | null;
  holidayOffPeak: [number, number] | null;
}

export interface BusPattern {
  /** 0 = outbound, 1 = return, as in the feed's `goBack`. */
  dir: number;
  /** Indexes into BusData.stops. */
  stops: number[];
  /** Route-stop ids, parallel to `stops`; they key the live arrival feed. */
  etaIds: number[];
}

export interface BusRoute {
  id: number;
  name: string;
  from: string;
  to: string;
  operator: string;
  fare: BusFare;
  headway: BusHeadway;
  patterns: BusPattern[];
}

export interface BusData {
  version: typeof SCHEMA_VERSION;
  generatedAt: string;
  sourceUpdatedAt: string;
  attribution: string[];
  stops: BusStop[];
  routes: BusRoute[];
}
