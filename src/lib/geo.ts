// Small geometry helpers. Everything works in WGS84 degrees and returns metres.

const EARTH_RADIUS_M = 6_371_008.8;
const toRad = (deg: number) => (deg * Math.PI) / 180;

export interface Point {
  lat: number;
  lon: number;
}

/** Great-circle distance in metres (haversine). */
export function distanceM(a: Point, b: Point): number {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Bucket grid for "what is within r metres of here" queries. A cell is roughly
 * `cellM` wide, so a query only touches the few cells that overlap its circle.
 */
export class SpatialGrid<T extends Point> {
  readonly items: readonly T[];
  private readonly cells = new Map<string, number[]>();
  private readonly latStep: number;
  private readonly lonStep: number;

  constructor(items: readonly T[], cellM = 250) {
    this.items = items;
    const refLat = items.length ? items.reduce((s, p) => s + p.lat, 0) / items.length : 25;
    this.latStep = cellM / 111_320;
    this.lonStep = cellM / (111_320 * Math.cos(toRad(refLat)));
    items.forEach((p, i) => {
      const key = this.key(this.cellOf(p.lat, this.latStep), this.cellOf(p.lon, this.lonStep));
      const bucket = this.cells.get(key);
      if (bucket) bucket.push(i);
      else this.cells.set(key, [i]);
    });
  }

  private cellOf(v: number, step: number) {
    return Math.floor(v / step);
  }

  private key(y: number, x: number) {
    return `${y}:${x}`;
  }

  /** Indexes of items within `radiusM`, nearest first, with their distances. */
  within(p: Point, radiusM: number): { index: number; distanceM: number }[] {
    const dy = Math.ceil(radiusM / 111_320 / this.latStep);
    const dx = Math.ceil(radiusM / (111_320 * Math.cos(toRad(p.lat))) / this.lonStep);
    const cy = this.cellOf(p.lat, this.latStep);
    const cx = this.cellOf(p.lon, this.lonStep);
    const out: { index: number; distanceM: number }[] = [];
    for (let y = cy - dy; y <= cy + dy; y++) {
      for (let x = cx - dx; x <= cx + dx; x++) {
        for (const i of this.cells.get(this.key(y, x)) ?? []) {
          const d = distanceM(p, this.items[i]!);
          if (d <= radiusM) out.push({ index: i, distanceM: d });
        }
      }
    }
    return out.sort((a, b) => a.distanceM - b.distanceM);
  }

  /** The nearest item within `maxM`, or null. */
  nearest(p: Point, maxM: number): { index: number; distanceM: number } | null {
    return this.within(p, maxM)[0] ?? null;
  }
}

/** Douglas–Peucker simplification on [lon, lat] pairs with a tolerance in metres. */
export function simplify(line: [number, number][], toleranceM: number): [number, number][] {
  if (line.length <= 2) return line.slice();
  const keep = new Uint8Array(line.length);
  keep[0] = 1;
  keep[line.length - 1] = 1;
  const stack: [number, number][] = [[0, line.length - 1]];
  while (stack.length) {
    const [s, e] = stack.pop()!;
    let maxD = 0;
    let idx = -1;
    for (let i = s + 1; i < e; i++) {
      const d = perpendicularM(line[i]!, line[s]!, line[e]!);
      if (d > maxD) {
        maxD = d;
        idx = i;
      }
    }
    if (idx >= 0 && maxD > toleranceM) {
      keep[idx] = 1;
      stack.push([s, idx], [idx, e]);
    }
  }
  return line.filter((_, i) => keep[i]);
}

function perpendicularM(p: [number, number], a: [number, number], b: [number, number]): number {
  // Local equirectangular projection is plenty accurate at city scale.
  const k = Math.cos(toRad(a[1])) * 111_320;
  const ax = a[0] * k;
  const ay = a[1] * 111_320;
  const bx = b[0] * k - ax;
  const by = b[1] * 111_320 - ay;
  const px = p[0] * k - ax;
  const py = p[1] * 111_320 - ay;
  const len2 = bx * bx + by * by;
  if (len2 === 0) return Math.hypot(px, py);
  const t = Math.max(0, Math.min(1, (px * bx + py * by) / len2));
  return Math.hypot(px - t * bx, py - t * by);
}

export const round = (v: number, digits: number) => {
  const f = 10 ** digits;
  return Math.round(v * f) / f;
};
