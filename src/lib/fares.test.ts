import { describe, expect, it } from 'vitest';
import { addFares, busFare, formatFare, metroFare, youbikeFare } from './fares.ts';
import { metroFixture } from '../test/fixtures.ts';

describe('busFare', () => {
  const stops = ['甲', '乙', '丙', '丁', '戊', '己'];
  const twoSeg = { kind: 'segments' as const, segments: 2, buffers: [['丙', '丁']] as [string, string][] };

  it('charges one segment when the ride does not pass a whole buffer zone', () => {
    expect(busFare(twoSeg, stops, 0, 2, 15)).toEqual({ min: 15, max: 15 }); // ends inside the zone
    expect(busFare(twoSeg, stops, 3, 5, 15)).toEqual({ min: 15, max: 15 }); // starts inside the zone
  });

  it('charges two segments when the ride crosses the buffer zone', () => {
    expect(busFare(twoSeg, stops, 1, 4, 15)).toEqual({ min: 30, max: 30 });
    // Same on the way back (indexes reversed).
    expect(busFare(twoSeg, stops, 4, 1, 15)).toEqual({ min: 30, max: 30 });
  });

  it('matches 捷運X站 written with or without the prefix and suffix', () => {
    const fare = { kind: 'segments' as const, segments: 2, buffers: [['滬江中學', '捷運公館']] as [string, string][] };
    expect(busFare(fare, ['A', '滬江中學', '捷運公館站', 'B'], 0, 3, 15)).toEqual({ min: 30, max: 30 });
  });

  it('falls back to a range when the buffer names are not on the route', () => {
    const fare = { kind: 'segments' as const, segments: 2, buffers: [['無此站', '丁']] as [string, string][] };
    expect(busFare(fare, stops, 0, 5, 15)).toEqual({ min: 15, max: 30 });
  });

  it('handles free and unknown fares', () => {
    expect(busFare({ kind: 'free' }, stops, 0, 5, 15)).toEqual({ min: 0, max: 0 });
    expect(busFare({ kind: 'unknown', note: '依里程計費' }, stops, 0, 5, 15)).toBeNull();
  });
});

describe('metroFare', () => {
  it('reads the fare matrix by station index', () => {
    const m = metroFixture();
    expect(metroFare(m, 0, 2)).toEqual({ min: 25, max: 25 });
    expect(metroFare({ ...m, fares: m.fares.map(() => null) }, 0, 2)).toBeNull();
  });
});

describe('youbikeFare', () => {
  const t = { freeMin: 30, blockMin: 30, perBlock: 10 };
  it('is free for the first 30 minutes, then NT$10 per started half hour', () => {
    expect(youbikeFare(12, t)).toEqual({ min: 0, max: 0 });
    expect(youbikeFare(30, t)).toEqual({ min: 0, max: 0 });
    expect(youbikeFare(31, t)).toEqual({ min: 10, max: 10 });
    expect(youbikeFare(75, t)).toEqual({ min: 20, max: 20 });
  });
});

describe('fare helpers', () => {
  it('adds ranges and propagates unknowns', () => {
    expect(addFares({ min: 15, max: 30 }, { min: 25, max: 25 })).toEqual({ min: 40, max: 55 });
    expect(addFares({ min: 15, max: 15 }, null)).toBeNull();
  });
  it('formats for people', () => {
    expect(formatFare({ min: 0, max: 0 })).toBe('免費');
    expect(formatFare({ min: 25, max: 25 })).toBe('NT$25');
    expect(formatFare({ min: 15, max: 30 })).toBe('NT$15–30');
    expect(formatFare(null)).toBe('票價未知');
  });
});
