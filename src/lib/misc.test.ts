import { describe, expect, it, vi } from 'vitest';
import type { StyleSpecification } from 'maplibre-gl';
import { busFixture, metroFixture, at } from '../test/fixtures.ts';
import { cached, etaLabel, parseDocks, parseEstimates } from './live.ts';
import { cyberizeStyle, PALETTE } from './mapStyle.ts';
import { buildNetwork } from './network.ts';
import { findNearby, resolvePlace, stationLabel } from './places.ts';
import type { TripOption } from './plan.ts';
import { bubbleRadii, rankOptions } from './rank.ts';
import { buildSearchIndex, normalize, search } from './search.ts';
import { decodePlace, encodePlace, readShareState, writeShareState } from './share.ts';

const opt = (kind: TripOption['kind'], minutes: number, km: number, fare: number | null): TripOption => ({
  kind,
  steps: [],
  minutes,
  km,
  fare: fare === null ? null : { min: fare, max: fare },
  kcal: 0,
  live: false,
});

describe('rankOptions (最省時／最省錢／走最短)', () => {
  const options = [opt('walk', 80, 5, 0), opt('bus', 30, 7, 15), opt('metro', 25, 8, 25), opt('mixed', 25, 6, null)];
  it('sorts by time; equal times keep their order', () => {
    expect(rankOptions(options, 'time').map((o) => o.kind)).toEqual(['metro', 'mixed', 'bus', 'walk']);
  });
  it('sorts by money with unknown fares last', () => {
    expect(rankOptions(options, 'money').map((o) => o.kind)).toEqual(['walk', 'bus', 'metro', 'mixed']);
  });
  it('sorts by distance', () => {
    expect(rankOptions(options, 'distance').map((o) => o.kind)).toEqual(['walk', 'mixed', 'bus', 'metro']);
  });
});

describe('bubbleRadii', () => {
  it('makes bubble area proportional to the value', () => {
    const [a, b] = bubbleRadii([100, 25], 20, 2) as number[];
    expect(a).toBe(20);
    expect(b).toBe(10); // a quarter of the value → half the radius → a quarter of the area
  });
  it('keeps zeros visible and unknowns empty', () => {
    expect(bubbleRadii([0, null, 10], 20, 3)).toEqual([3, null, 20]);
    expect(bubbleRadii([0, 0], 20, 3)).toEqual([3, 3]);
  });
});

describe('share links', () => {
  it('round-trips stations, bus stops and points', () => {
    for (const p of [
      { kind: 'station' as const, id: 'BL12' },
      { kind: 'busStop' as const, id: 3698 },
      { kind: 'point' as const, lat: 25.0478, lon: 121.517, label: '台北101' },
    ])
      expect(decodePlace(encodePlace(p))).toEqual(p);
  });
  it('reads and writes the whole query', () => {
    const s = readShareState('?from=R10&to=25.03360,121.56480~%E5%8F%B0%E5%8C%97101&by=money');
    expect(s).toEqual({
      from: { kind: 'station', id: 'R10' },
      to: { kind: 'point', lat: 25.0336, lon: 121.5648, label: '台北101' },
      by: 'money',
    });
    expect(readShareState(writeShareState(s))).toEqual(s);
  });
  it('ignores junk', () => {
    expect(decodePlace('hello')).toBeNull();
    expect(decodePlace('95,121')).toBeNull();
    expect(readShareState('?by=fastest').by).toBe('time');
    expect(writeShareState({ from: null, to: null, by: 'time' })).toBe('');
  });
});

describe('search', () => {
  const index = buildSearchIndex(metroFixture(), busFixture(), [{ id: 'd', name: '臺北甲站', lat: 25, lon: 121.5, bikes: 1, slots: 1 }]);
  it('treats 臺 and 台 as the same character', () => {
    expect(normalize('臺北 Main')).toBe('台北main');
    expect(search(index, '台北甲').map((e) => e.kind)).toEqual(['dock']);
  });
  it('lists exact station names first, then other kinds', () => {
    expect(search(index, '甲')[0]).toMatchObject({ kind: 'station', name: '甲' });
    expect(search(index, 'Q站')[0]).toMatchObject({ kind: 'busStop', detail: '公車站 · 1 條路線' });
    expect(search(index, '')).toEqual([]);
  });
});

describe('places', () => {
  it('labels stations the way they are signposted', () => {
    expect(stationLabel('北投')).toBe('捷運北投站');
    expect(stationLabel('台北車站')).toBe('捷運台北車站');
  });
  it('resolves share references', () => {
    const m = metroFixture();
    expect(resolvePlace({ kind: 'station', id: 'T02' }, m, null)?.name).toBe('捷運乙站');
    expect(resolvePlace({ kind: 'busStop', id: 102 }, m, busFixture())?.name).toBe('Q站');
    expect(resolvePlace({ kind: 'station', id: 'ZZ9' }, m, null)).toBeNull();
  });
  it('finds stations, stops with live arrivals, and docks nearby', () => {
    const net = buildNetwork(metroFixture(), busFixture(), { transferRadiusM: 300, busDetour: 1 });
    const r = findNearby(net, at(1, 0.02), { station: 300, stop: 300, dock: 300 }, new Map([[9102, 120]]), [
      { id: 'd', name: 'dock', ...at(1, 0.1), bikes: 2, slots: 3 },
    ]);
    expect(r.stations.map((s) => s.station.name)).toEqual(['乙']);
    expect(r.stops[0]!.name).toBe('R站');
    // Route 9 both ways; the one with a live arrival comes first. R is 2nd on the return trip → eta id 9102.
    expect(r.stops[0]!.routes.map((x) => [x.headsign, x.eta])).toEqual([
      ['P', 120],
      ['S', undefined],
    ]);
    expect(r.docks).toHaveLength(1);
  });
});

describe('live feeds', () => {
  it('parses arrivals and docks', () => {
    expect(parseEstimates({ BusInfo: [{ StopID: 1, EstimateTime: '180' }, { StopID: 2, EstimateTime: '-3' }] })).toEqual(
      new Map([
        [1, 180],
        [2, -3],
      ]),
    );
    const docks = parseDocks([
      { sno: '1', sna: 'YouBike2.0_捷運科技大樓站', act: '1', latitude: 25, longitude: 121.5, available_rent_bikes: 3, available_return_bikes: 4 },
      { sno: '2', sna: 'YouBike2.0_停用站', act: '0', latitude: 25, longitude: 121.5, available_rent_bikes: 0, available_return_bikes: 0 },
    ]);
    expect(docks).toEqual([{ id: '1', name: '捷運科技大樓站', lat: 25, lon: 121.5, bikes: 3, slots: 4 }]);
  });
  it('labels arrivals like the e-bus signs', () => {
    expect(etaLabel(30)).toBe('進站中');
    expect(etaLabel(300)).toBe('5 分');
    expect(etaLabel(-1)).toBe('尚未發車');
    expect(etaLabel(-3)).toBe('末班車已過');
    expect(etaLabel(undefined)).toBe('—');
  });
  it('shares one request within the time-to-live and retries after a failure', async () => {
    vi.useFakeTimers();
    const load = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(42);
    const get = cached(load, 1000);
    await expect(get()).rejects.toThrow('offline');
    await expect(get()).resolves.toBe(42);
    await expect(get()).resolves.toBe(42);
    expect(load).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(1500);
    await get();
    expect(load).toHaveBeenCalledTimes(3);
    vi.useRealTimers();
  });
});

describe('cyberizeStyle', () => {
  const style = {
    version: 8,
    sources: {},
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': '#fff' } },
      { id: 'water', type: 'fill', source: 'x', paint: { 'fill-color': '#00f' } },
      { id: 'landcover_wood', type: 'fill', source: 'x', paint: { 'fill-pattern': 'wood-pattern' } },
      { id: 'highway_primary', type: 'line', source: 'x', paint: { 'line-color': '#fff', 'line-width': 3 } },
      { id: 'road_minor', type: 'line', source: 'x', paint: { 'line-color': '#fff' } },
      { id: 'place_city', type: 'symbol', source: 'x', layout: { 'text-field': '{name:latin}' }, paint: {} },
      { id: 'housenumber', type: 'symbol', source: 'x', layout: { 'text-field': '{housenumber}' }, paint: {} },
    ],
  } as unknown as StyleSpecification;
  const out = cyberizeStyle(style).layers as unknown as { id: string; paint: Record<string, unknown>; layout: Record<string, unknown> }[];
  const layer = (id: string) => out.find((l) => l.id === id)!;

  it('recolours by layer kind and keeps other paint properties', () => {
    expect(layer('background').paint['background-color']).toBe(PALETTE.void);
    expect(layer('water').paint['fill-color']).toBe(PALETTE.water);
    expect(layer('highway_primary').paint).toEqual({ 'line-color': PALETTE.roadMajor, 'line-width': 3 });
    expect(layer('road_minor').paint['line-color']).toBe(PALETTE.roadMinor);
  });
  it('drops texture fills the dark style cannot load', () => {
    expect(layer('landcover_wood').paint['fill-pattern']).toBeUndefined();
  });
  it('shows local (Chinese) names but leaves house numbers alone', () => {
    expect(JSON.stringify(layer('place_city').layout['text-field'])).toContain('"name"');
    expect(layer('housenumber').layout['text-field']).toBe('{housenumber}');
  });
  it('does not modify the input', () => {
    expect(style.layers[0]).toMatchObject({ paint: { 'background-color': '#fff' } });
  });
});
