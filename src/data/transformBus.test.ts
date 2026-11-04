import { describe, expect, it } from 'vitest';
import { parseFare, parseHeadway, transformBus, type RawBusRoute, type RawBusStop } from './transformBus.ts';

describe('parseHeadway', () => {
  it('reads "MMNN" as a minute range', () => {
    expect(parseHeadway('0510')).toEqual([5, 10]);
    expect(parseHeadway('1525')).toEqual([15, 25]);
  });
  it('treats blanks and zeros as unknown', () => {
    expect(parseHeadway('')).toBeNull();
    expect(parseHeadway('0000')).toBeNull();
    expect(parseHeadway(undefined)).toBeNull();
    expect(parseHeadway('60120')).toBeNull();
  });
});

describe('parseFare', () => {
  it('reads segment fares and their buffer zones', () => {
    expect(parseFare('兩段票', '景美女中-石壁坑')).toEqual({
      kind: 'segments',
      segments: 2,
      buffers: [['景美女中', '石壁坑']],
    });
    // Real example from route 508: two buffer zones separated by 、 and full-width dashes.
    expect(parseFare('三段票', '蘆洲總站－徐匯中學、重陽橋－士林國中')).toEqual({
      kind: 'segments',
      segments: 3,
      buffers: [
        ['蘆洲總站', '徐匯中學'],
        ['重陽橋', '士林國中'],
      ],
    });
  });
  it('knows free routes and keeps anything else as unknown', () => {
    expect(parseFare('免費', '')).toEqual({ kind: 'free' });
    expect(parseFare('依里程計費', '')).toEqual({ kind: 'unknown', note: '依里程計費' });
    expect(parseFare('', '')).toEqual({ kind: 'unknown', note: '未提供票價' });
  });
});

describe('transformBus', () => {
  const route = (id: number, name: string): RawBusRoute => ({
    Id: id,
    nameZh: name,
    providerName: '測試客運',
    departureZh: '起站',
    destinationZh: '迄站',
    peakHeadway: '0510',
    offPeakHeadway: '1020',
    holidayPeakHeadway: '',
    holidayOffPeakHeadway: '1530',
    segmentBufferZh: '',
    ticketPriceDescriptionZh: '一段票',
  });
  const stop = (id: number, routeId: number, seqNo: number, goBack: string, loc: number, name = `站${loc}`): RawBusStop => ({
    Id: id,
    routeId,
    nameZh: name,
    seqNo,
    goBack,
    latitude: String(25 + loc / 1000),
    longitude: '121.5',
    stopLocationId: loc,
  });

  const routes = {
    EssentialInfo: { UpdateTime: '2026/11/04 07:03:04' },
    // The feed repeats a route once per path variant; route 3 has no stops and is dropped.
    BusInfo: [route(1, '1'), route(1, '1'), route(2, '2'), route(3, '3')],
  };
  const stops = {
    BusInfo: [
      stop(11, 1, 2, '0', 502),
      stop(10, 1, 1, '0', 501), // listed out of order on purpose
      stop(12, 1, 1, '1', 502),
      stop(13, 1, 2, '1', 501),
      stop(20, 2, 1, '0', 501, '站501'), // same pole as route 1 → one stop
      stop(21, 2, 2, '0', 503),
      { ...stop(22, 2, 3, '0', 504), latitude: '0' }, // broken coordinates are skipped
    ],
  };
  const data = transformBus(routes, stops, '2026-11-04T00:00:00Z');

  it('merges poles shared by several routes', () => {
    expect(data.stops.map((s) => s.id)).toEqual([502, 501, 503]);
  });

  it('keeps one entry per route with stops in sequence order per direction', () => {
    expect(data.routes.map((r) => r.id)).toEqual([1, 2]);
    const r1 = data.routes[0]!;
    expect(r1.patterns.map((p) => p.dir)).toEqual([0, 1]);
    expect(r1.patterns[0]!.stops.map((i) => data.stops[i]!.id)).toEqual([501, 502]);
    expect(r1.patterns[0]!.etaIds).toEqual([10, 11]);
    expect(r1.patterns[1]!.stops.map((i) => data.stops[i]!.id)).toEqual([502, 501]);
  });

  it('carries headways, fare and the feed timestamp', () => {
    expect(data.routes[0]!.headway).toEqual({ peak: [5, 10], offPeak: [10, 20], holidayPeak: null, holidayOffPeak: [15, 30] });
    expect(data.routes[0]!.fare).toEqual({ kind: 'segments', segments: 1, buffers: [] });
    expect(data.sourceUpdatedAt).toBe('2026/11/04 07:03:04');
  });
});
