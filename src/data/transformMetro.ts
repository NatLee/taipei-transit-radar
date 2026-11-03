// Builds MetroData from four open sources:
//  - OpenStreetMap route relations (Overpass JSON): station order per service pattern + track shapes
//  - data.taipei fare table (CSV): which stations exist, fares and track distances between them
//  - data.taipei transfer walking times
//  - data.taipei headways
// The fare table is the authority on the station list: a stop that is not in it is not a
// Taipei Metro station (e.g. the Airport MRT shares the name 台北車站) and is dropped.

import { distanceM, round, simplify } from '../lib/geo.ts';
import {
  SCHEMA_VERSION,
  type HeadwayTable,
  type HeadwayWindow,
  type LonLat,
  type MetroData,
  type MetroLine,
  type MetroPattern,
  type MetroStation,
} from './schema.ts';

export interface MetroLineConfig {
  code: string;
  name: string;
  nameEn: string;
  color: string;
  /** Which OSM route relations belong to this line. */
  match: { ref?: string; name?: RegExp; notName?: RegExp };
  /** `routeid` in the headway dataset (without quotes), or null when it has none for this line. */
  headwayRoute: string | null;
  fallbackHeadwayMin: number;
}

export interface OsmElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  tags?: Record<string, string>;
  members?: { type: string; ref: number; role: string }[];
  geometry?: { lat: number; lon: number }[];
}

export interface FareTable {
  names: string[];
  fare: Map<string, number>;
  km: Map<string, number>;
}

export interface MetroSources {
  osm: OsmElement[];
  fareCsv: string;
  transferRows: { station: string; time: string }[];
  headwayRows: { routeid: string; servicedays: string; headways: string }[];
}

export const METRO_ATTRIBUTION = [
  '© OpenStreetMap contributors（ODbL）：路線站序與軌道形狀',
  '臺北大眾捷運股份有限公司 臺北捷運系統票價、轉乘步行時間、發車班距（政府資料開放授權條款－第1版）',
];

const STOP_ROLES = new Set(['stop', 'stop_entry_only', 'stop_exit_only']);
const pairKey = (a: string, b: string) => `${a}\u0000${b}`;

/**
 * Maps a station name as written by another dataset onto the fare table's spelling.
 * The transfer dataset writes "捷運北投站" for 北投 but "捷運台北車站" for 台北車站, so the
 * suffix can only be dropped when the shorter name is the one that exists.
 */
export function resolveStationName(raw: string, known: ReadonlySet<string>): string | null {
  const base = raw.trim().replace(/^捷運/, '');
  for (const candidate of [raw.trim(), base, base.replace(/站$/, '')]) {
    if (known.has(candidate)) return candidate;
  }
  return null;
}

export function parseCsv(text: string): string[][] {
  return text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter((l) => l.trim() !== '')
    .map((l) => l.split(',').map((c) => c.trim()));
}

export function parseFareTable(csv: string): FareTable {
  const [header, ...rows] = parseCsv(csv);
  if (!header) throw new Error('fare table is empty');
  const col = (prefix: string) => {
    const i = header.findIndex((h) => h.startsWith(prefix));
    if (i < 0) throw new Error(`fare table has no column starting with ${prefix}`);
    return i;
  };
  const [from, to, adult, dist] = [col('起站'), col('訖站'), col('全票'), col('距離')];
  const names: string[] = [];
  const seen = new Set<string>();
  const fare = new Map<string, number>();
  const km = new Map<string, number>();
  for (const r of rows) {
    const a = (r[from] ?? '').trim();
    const b = (r[to] ?? '').trim();
    if (!a || !b) continue;
    for (const n of [a, b]) {
      if (!seen.has(n)) {
        seen.add(n);
        names.push(n);
      }
    }
    const f = Number(r[adult]);
    const d = Number(r[dist]);
    if (Number.isFinite(f)) fare.set(pairKey(a, b), f);
    if (Number.isFinite(d)) km.set(pairKey(a, b), d);
  }
  return { names, fare, km };
}

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  const v = (h ?? 0) * 60 + (m ?? 0);
  return v === 0 ? 24 * 60 : v; // "00:00" closes the service day
};

/** Parses the PostgreSQL-array text of the headway dataset into service windows. */
export function parseHeadwayWindows(raw: string): HeadwayWindow[] {
  const out: HeadwayWindow[] = [];
  for (const m of raw.matchAll(/\{\s*\d+\s*,\s*'(\d{2}:\d{2})'\s*,\s*'(\d{2}:\d{2})'\s*,\s*(\d+)\s*,\s*(\d+)\s*\}/g)) {
    const min = Number(m[3]);
    const max = Number(m[4]);
    if (min === 0 && max === 0) continue; // no trains of this pattern in that window
    const start = toMinutes(m[1]!) % (24 * 60);
    out.push({ start, end: toMinutes(m[2]!), min, max });
  }
  return out;
}

export function buildHeadwayTable(rows: MetroSources['headwayRows'], routeId: string | null): HeadwayTable | null {
  if (!routeId) return null;
  const strip = (s: string) => s.replace(/'/g, '').trim();
  const mine = rows.filter((r) => strip(r.routeid) === routeId);
  if (!mine.length) return null;
  const table: HeadwayTable = { weekday: [], holiday: [] };
  for (const r of mine) {
    const windows = parseHeadwayWindows(r.headways);
    if (r.servicedays.includes('平日')) table.weekday.push(...windows);
    if (r.servicedays.includes('假日')) table.holiday.push(...windows);
  }
  return table.weekday.length || table.holiday.length ? table : null;
}

function relationMatches(tags: Record<string, string>, match: MetroLineConfig['match']): boolean {
  const name = tags.name ?? '';
  if (match.ref !== undefined && tags.ref !== match.ref) return false;
  if (match.name && !match.name.test(name)) return false;
  if (match.notName && match.notName.test(name)) return false;
  return true;
}

/** True when every item of `small` appears in `big` in the same order (gaps allowed). */
export function isOrderedSubset(small: readonly string[], big: readonly string[]): boolean {
  let j = 0;
  for (const item of big) if (item === small[j]) j++;
  return j === small.length;
}

export interface MetroBuildResult {
  data: MetroData;
  warnings: string[];
}

export function transformMetro(
  src: MetroSources,
  lines: MetroLineConfig[],
  generatedAt: string,
  simplifyToleranceM = 6,
): MetroBuildResult {
  const warnings: string[] = [];
  const fares = parseFareTable(src.fareCsv);
  const known = new Set(fares.names);
  const nodes = new Map<number, OsmElement>();
  const ways = new Map<number, OsmElement>();
  for (const e of src.osm) {
    if (e.type === 'node') nodes.set(e.id, e);
    else if (e.type === 'way') ways.set(e.id, e);
  }
  const relations = src.osm.filter((e) => e.type === 'relation' && e.tags);

  // 1. Ordered station names per relation, grouped by line.
  const sequences: { line: string; names: string[] }[] = [];
  const shapes = new Map<string, LonLat[][]>();
  const stopCoords = new Map<string, { lat: number; lon: number; en?: string }[]>();
  for (const line of lines) {
    const seenWays = new Set<number>();
    const lineShapes: LonLat[][] = [];
    for (const rel of relations.filter((r) => relationMatches(r.tags!, line.match))) {
      const names: string[] = [];
      for (const m of rel.members ?? []) {
        if (m.type === 'node' && STOP_ROLES.has(m.role)) {
          const n = nodes.get(m.ref);
          const raw = n?.tags?.name;
          if (!n || !raw) continue;
          const name = resolveStationName(raw, known);
          if (!name) {
            warnings.push(`${line.code}: OSM stop "${raw}" is not in the fare table, skipped`);
            continue;
          }
          if (names.at(-1) !== name) names.push(name);
          const list = stopCoords.get(name) ?? [];
          list.push({ lat: n.lat!, lon: n.lon!, en: n.tags?.['name:en'] });
          stopCoords.set(name, list);
        } else if (m.type === 'way' && m.role === '' && !seenWays.has(m.ref)) {
          seenWays.add(m.ref);
          const geom = ways.get(m.ref)?.geometry;
          if (geom && geom.length >= 2) {
            const pts = geom.map((g) => [g.lon, g.lat] as [number, number]);
            lineShapes.push(simplify(pts, simplifyToleranceM).map(([x, y]) => [round(x, 5), round(y, 5)] as LonLat));
          }
        }
      }
      if (names.length >= 2) sequences.push({ line: line.code, names });
    }
    if (!sequences.some((s) => s.line === line.code)) warnings.push(`${line.code}: no OSM route relation matched`);
    shapes.set(line.code, lineShapes);
  }

  // 2. Every Taipei Metro service runs both ways over the same stations, and none skips stops.
  //    So add the reverse of each relation (some directions are missing or incomplete in OSM)
  //    and drop any pattern whose stations are an ordered subset of a longer one: that is a
  //    short-turn service or a relation with stops missing, never an express.
  const bothWays = sequences.flatMap((s) => [s, { line: s.line, names: [...s.names].reverse() }]);
  const kept = bothWays.filter(
    (s, i) =>
      !bothWays.some(
        (o, j) =>
          j !== i &&
          o.line === s.line &&
          isOrderedSubset(s.names, o.names) &&
          (o.names.length > s.names.length || j < i),
      ),
  );

  // 3. Stations: coordinates and codes from OSM station nodes, falling back to stop positions.
  const lineCodes = lines.map((l) => l.code).sort((a, b) => b.length - a.length);
  const codePattern = new RegExp(`^(${lineCodes.join('|')})\\d+[A-Z]?$`);
  const stationNodes = [...nodes.values()].filter((n) => n.tags?.railway === 'station' && n.tags.name);
  const usedNames = [...new Set(kept.flatMap((s) => s.names))];
  const missing = fares.names.filter((n) => !usedNames.includes(n));
  if (missing.length) warnings.push(`fare-table stations without an OSM route: ${missing.join(', ')}`);

  const transfer = new Map<string, number>();
  for (const r of src.transferRows) {
    const name = resolveStationName(r.station, known);
    if (name) transfer.set(name, Number(r.time));
    else warnings.push(`transfer time for unknown station "${r.station}" skipped`);
  }

  const stations: MetroStation[] = usedNames.map((name) => {
    const own = stationNodes.filter((n) => resolveStationName(n.tags!.name!, known) === name);
    const codes = [
      ...new Set(own.flatMap((n) => (n.tags!.ref ?? '').split(/[;,/]/).map((c) => c.trim())).filter((c) => codePattern.test(c))),
    ].sort();
    const withCodes = own.filter((n) => (n.tags!.ref ?? '').split(/[;,/]/).some((c) => codePattern.test(c.trim())));
    const pts: { lat: number; lon: number }[] = withCodes.length
      ? withCodes.map((n) => ({ lat: n.lat!, lon: n.lon! }))
      : (stopCoords.get(name) ?? []);
    const lat = pts.reduce((s, p) => s + p.lat, 0) / pts.length;
    const lon = pts.reduce((s, p) => s + p.lon, 0) / pts.length;
    const nameEn = withCodes.find((n) => n.tags!['name:en'])?.tags!['name:en'] ?? stopCoords.get(name)?.find((p) => p.en)?.en ?? '';
    if (!codes.length) warnings.push(`${name}: no station code found in OSM`);
    const minutes = transfer.get(name);
    return {
      id: codes[0] ?? name,
      name,
      nameEn,
      codes,
      lat: round(lat, 6),
      lon: round(lon, 6),
      lines: lines.map((l) => l.code).filter((c) => kept.some((s) => s.line === c && s.names.includes(name))),
      transferMin: Number.isFinite(minutes) ? minutes! : null,
    };
  });
  stations.sort((a, b) => a.id.localeCompare(b.id));
  const indexOf = new Map(stations.map((s, i) => [s.name, i]));

  // 4. Patterns with track distances from the fare table.
  const patterns: MetroPattern[] = kept.map((s) => ({
    line: s.line,
    stations: s.names.map((n) => indexOf.get(n)!),
    km: s.names.slice(1).map((b, i) => {
      const a = s.names[i]!;
      const d = fares.km.get(pairKey(a, b)) ?? fares.km.get(pairKey(b, a));
      if (d && d > 0) return d;
      const sa = stations[indexOf.get(a)!]!;
      const sb = stations[indexOf.get(b)!]!;
      warnings.push(`${a}–${b}: no fare-table distance, using straight-line distance`);
      return round(distanceM(sa, sb) / 1000, 2);
    }),
  }));

  const metroLines: MetroLine[] = lines
    .filter((l) => kept.some((s) => s.line === l.code))
    .map((l) => ({
      code: l.code,
      name: l.name,
      nameEn: l.nameEn,
      color: l.color,
      headways: buildHeadwayTable(src.headwayRows, l.headwayRoute),
      fallbackHeadwayMin: l.fallbackHeadwayMin,
      shape: shapes.get(l.code) ?? [],
    }));

  const n = stations.length;
  const fareMatrix: (number | null)[] = new Array(n * n).fill(null);
  stations.forEach((a, i) =>
    stations.forEach((b, j) => {
      fareMatrix[i * n + j] = fares.fare.get(pairKey(a.name, b.name)) ?? null;
    }),
  );

  return {
    data: {
      version: SCHEMA_VERSION,
      generatedAt,
      attribution: METRO_ATTRIBUTION,
      stations,
      lines: metroLines,
      patterns,
      fares: fareMatrix,
    },
    warnings,
  };
}
