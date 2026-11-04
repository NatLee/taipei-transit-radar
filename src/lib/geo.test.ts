import { describe, expect, it } from 'vitest';
import { distanceM, simplify, SpatialGrid } from './geo.ts';

describe('distanceM', () => {
  it('measures Taipei Main Station to Taipei 101 at about 5.1 km', () => {
    // 0.0142° of latitude ≈ 1.58 km and 0.0478° of longitude ≈ 4.82 km at 25°N → √(1.58² + 4.82²) ≈ 5.07 km.
    const d = distanceM({ lat: 25.0478, lon: 121.517 }, { lat: 25.0336, lon: 121.5648 });
    expect(d).toBeGreaterThan(5000);
    expect(d).toBeLessThan(5150);
  });

  it('is zero for the same point and symmetric', () => {
    const a = { lat: 25, lon: 121.5 };
    const b = { lat: 25.01, lon: 121.52 };
    expect(distanceM(a, a)).toBe(0);
    expect(distanceM(a, b)).toBeCloseTo(distanceM(b, a), 6);
  });
});

describe('SpatialGrid', () => {
  const pts = [
    { lat: 25.0, lon: 121.5 },
    { lat: 25.001, lon: 121.5 }, // ~111 m north
    { lat: 25.01, lon: 121.5 }, // ~1.1 km north
  ];
  const grid = new SpatialGrid(pts, 200);

  it('finds points within a radius, nearest first', () => {
    const hits = grid.within({ lat: 25.0, lon: 121.5 }, 500);
    expect(hits.map((h) => h.index)).toEqual([0, 1]);
    expect(hits[1]!.distanceM).toBeCloseTo(111, 0);
  });

  it('agrees with a brute-force scan across cell borders', () => {
    const many = Array.from({ length: 400 }, (_, i) => ({ lat: 25 + (i % 20) * 0.0013, lon: 121.5 + Math.floor(i / 20) * 0.0017 }));
    const g = new SpatialGrid(many, 150);
    const q = { lat: 25.012, lon: 121.516 };
    const expected = many.map((p, i) => ({ i, d: distanceM(q, p) })).filter((x) => x.d <= 420).map((x) => x.i).sort();
    expect(g.within(q, 420).map((h) => h.index).sort()).toEqual(expected);
  });

  it('returns null when nothing is close enough', () => {
    expect(grid.nearest({ lat: 26, lon: 122 }, 1000)).toBeNull();
  });
});

describe('simplify', () => {
  it('drops points that sit on a straight line', () => {
    const line: [number, number][] = [
      [121.5, 25],
      [121.501, 25],
      [121.502, 25],
      [121.503, 25.0001],
    ];
    expect(simplify(line, 20)).toEqual([line[0], line[3]]);
  });

  it('keeps a real corner', () => {
    const line: [number, number][] = [
      [121.5, 25],
      [121.51, 25],
      [121.51, 25.01],
    ];
    expect(simplify(line, 20)).toHaveLength(3);
  });
});
