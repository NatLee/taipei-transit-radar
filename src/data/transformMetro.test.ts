import { describe, expect, it } from 'vitest';
import {
  buildHeadwayTable,
  isOrderedSubset,
  parseFareTable,
  parseHeadwayWindows,
  resolveStationName,
  transformMetro,
  type MetroLineConfig,
  type OsmElement,
} from './transformMetro.ts';

const known = new Set(['北投', '台北車站', '淡水']);

describe('resolveStationName', () => {
  it('maps other datasets onto the fare-table spelling', () => {
    expect(resolveStationName('捷運北投站', known)).toBe('北投');
    // The transfer dataset writes 台北車站 without an extra 站: the suffix must stay.
    expect(resolveStationName('捷運台北車站', known)).toBe('台北車站');
    expect(resolveStationName('淡水', known)).toBe('淡水');
    expect(resolveStationName('桃園機場第一航廈', known)).toBeNull();
  });
});

describe('isOrderedSubset', () => {
  it('accepts gaps but not reordering', () => {
    expect(isOrderedSubset(['a', 'c'], ['a', 'b', 'c'])).toBe(true);
    expect(isOrderedSubset(['c', 'a'], ['a', 'b', 'c'])).toBe(false);
    expect(isOrderedSubset(['a', 'x'], ['a', 'b', 'c'])).toBe(false);
  });
});

describe('parseFareTable', () => {
  it('finds columns by name and keeps the official station names', () => {
    const csv = '﻿起站,訖站,全票票價[金額],優惠票價,距離\r\n台北車站,淡水,50,20,20.88\r\n淡水,台北車站,50,20,20.88\r\n';
    const t = parseFareTable(csv);
    expect(t.names).toEqual(['台北車站', '淡水']);
    expect(t.fare.get('台北車站\u0000淡水')).toBe(50);
    expect(t.km.get('淡水\u0000台北車站')).toBe(20.88);
  });
  it('fails loudly when a column is missing', () => {
    expect(() => parseFareTable('起站,訖站\n')).toThrow(/全票/);
  });
});

describe('headways', () => {
  // A real row from data.taipei (文湖線 weekdays).
  const raw = "'{0,'06:00','07:00',4,10},{1,'07:00','09:00',2,4},{0,'23:00','00:00',12,12},{0,'00:00','00:00',0,0}'";
  it('parses windows and drops "no service" ones', () => {
    expect(parseHeadwayWindows(raw)).toEqual([
      { start: 360, end: 420, min: 4, max: 10 },
      { start: 420, end: 540, min: 2, max: 4 },
      { start: 1380, end: 1440, min: 12, max: 12 },
    ]);
  });
  it('splits weekday and holiday rows of one route', () => {
    const rows = [
      { routeid: "'BR-1'", servicedays: "'{'平日',1,1,1,1,1,0,0,0}'", headways: raw },
      { routeid: "'BR-1'", servicedays: "'{'假日',0,0,0,0,0,1,1,1}'", headways: "'{0,'06:00','23:00',4,10}'" },
      { routeid: "'R-1'", servicedays: "'{'平日'}'", headways: raw },
    ];
    const t = buildHeadwayTable(rows, 'BR-1')!;
    expect(t.weekday).toHaveLength(3);
    expect(t.holiday).toEqual([{ start: 360, end: 1380, min: 4, max: 10 }]);
    expect(buildHeadwayTable(rows, null)).toBeNull();
    expect(buildHeadwayTable(rows, 'Y-1')).toBeNull();
  });
});

describe('transformMetro', () => {
  // Line R: 淡水 – 北投 – 台北車站. The northbound relation in "OSM" lacks 北投 (incomplete),
  // a short-turn relation runs 北投 – 台北車站, and the Airport MRT also has a 台北車站 stop
  // next to a station 三重 that is not in the fare table.
  const node = (id: number, name: string, lat: number, extra: Record<string, string> = {}): OsmElement => ({
    type: 'node',
    id,
    lat,
    lon: 121.5,
    tags: { name, ...extra },
  });
  const rel = (id: number, tags: Record<string, string>, stops: number[], ways: number[] = []): OsmElement => ({
    type: 'relation',
    id,
    tags: { type: 'route', ...tags },
    members: [
      ...stops.map((ref) => ({ type: 'node', ref, role: 'stop' })),
      ...ways.map((ref) => ({ type: 'way', ref, role: '' })),
    ],
  });
  const osm: OsmElement[] = [
    node(1, '淡水', 25.16),
    node(2, '北投', 25.13),
    node(3, '台北車站', 25.05),
    node(4, '三重', 25.06),
    node(91, '台北車站', 25.0478, { railway: 'station', ref: 'R10;BL12', 'name:en': 'Taipei Main Station' }),
    node(92, '淡水', 25.168, { railway: 'station', ref: 'R28', 'name:en': 'Tamsui' }),
    node(93, '北投', 25.132, { railway: 'station', ref: 'R22', 'name:en': 'Beitou' }),
    node(94, '台北車站', 25.049, { railway: 'station', ref: 'A1' }),
    { type: 'way', id: 500, geometry: [{ lat: 25.16, lon: 121.5 }, { lat: 25.05, lon: 121.5 }] },
    rel(10, { ref: 'R', name: '淡水信義線 南向' }, [1, 2, 3], [500]),
    rel(11, { ref: 'R', name: '淡水信義線 北向' }, [3, 1], [500]),
    rel(12, { ref: 'R', name: '區間車' }, [2, 3]),
    rel(20, { ref: 'A', name: '機場捷運' }, [3, 4]),
  ];
  const fareCsv = [
    '起站,訖站,全票票價,敬老,距離',
    '淡水,北投,25,10,6.2',
    '北投,台北車站,35,14,14.7',
    '淡水,台北車站,50,20,20.88',
  ].join('\n');
  const lines: MetroLineConfig[] = [
    { code: 'R', name: '淡水信義線', nameEn: 'Tamsui-Xinyi Line', color: '#e3002c', match: { ref: 'R' }, headwayRoute: null, fallbackHeadwayMin: 10 },
  ];
  const { data, warnings } = transformMetro(
    { osm, fareCsv, transferRows: [{ station: '捷運台北車站', time: '4' }], headwayRows: [] },
    lines,
    '2026-11-04T00:00:00Z',
  );
  const names = (p: { stations: number[] }) => p.stations.map((i) => data.stations[i]!.name);

  it('keeps one full pattern per direction and drops incomplete or short-turn relations', () => {
    expect(data.patterns.map(names)).toEqual([
      ['淡水', '北投', '台北車站'],
      ['台北車站', '北投', '淡水'],
    ]);
  });

  it('uses fare-table track distances between neighbours', () => {
    expect(data.patterns[0]!.km).toEqual([6.2, 14.7]);
  });

  it('builds stations from OSM station nodes with official codes only', () => {
    const tpe = data.stations.find((s) => s.name === '台北車站')!;
    // Only codes of configured lines count: BL12 (no BL line in this test) and the Airport MRT's A1 are dropped.
    expect(tpe.codes).toEqual(['R10']);
    expect(tpe.id).toBe('R10');
    expect(tpe.nameEn).toBe('Taipei Main Station');
    expect(tpe.transferMin).toBe(4);
    expect(tpe.lat).toBeCloseTo(25.0478, 4);
    expect(data.stations.some((s) => s.name === '三重')).toBe(false);
  });

  it('fills the fare matrix and the line shape', () => {
    const n = data.stations.length;
    const i = data.stations.findIndex((s) => s.name === '淡水');
    const j = data.stations.findIndex((s) => s.name === '台北車站');
    expect(data.fares[i * n + j]).toBe(50);
    expect(data.fares[j * n + i]).toBeNull(); // only one direction is in this tiny table
    expect(data.lines[0]!.shape).toHaveLength(1);
  });

  it('reports stops it could not place', () => {
    expect(warnings.some((w) => w.includes('三重'))).toBe(false); // other lines are not inspected
    expect(warnings).toEqual([]);
  });
});
