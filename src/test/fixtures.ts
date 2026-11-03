// A tiny made-up city for tests. Coordinates are around Taipei but the network is fictional:
//
//   MRT line "T":  A ── B ── C        (1 km apart, west → east along lat 25.05)
//   Bus route "9": P ── Q ── R ── S   (runs north–south, crossing the MRT at B)
//
// Fares, headways and distances are chosen so expected results can be worked out by hand.

import { SCHEMA_VERSION, type BusData, type MetroData } from '../data/schema.ts';

const LAT = 25.05;
/** 1 km of longitude at this latitude ≈ 0.009922° (111.32 km × cos 25.05°). */
const KM_LON = 1 / (111.32 * Math.cos((LAT * Math.PI) / 180));
const KM_LAT = 1 / 111.32;
const LON0 = 121.5;

export const at = (xKm: number, yKm: number) => ({ lat: LAT + yKm * KM_LAT, lon: LON0 + xKm * KM_LON });

export function metroFixture(): MetroData {
  const names = ['甲', '乙', '丙'];
  const stations = names.map((name, i) => ({
    id: `T0${i + 1}`,
    name,
    nameEn: `S${i}`,
    codes: [`T0${i + 1}`],
    ...at(i, 0),
    lines: ['T'],
    transferMin: null,
  }));
  // Fare: NT$20 within one stop, NT$25 for two.
  const fares = [20, 20, 25, 20, 20, 20, 25, 20, 20];
  return {
    version: SCHEMA_VERSION,
    generatedAt: '2026-11-04T00:00:00Z',
    attribution: [],
    stations,
    lines: [
      {
        code: 'T',
        name: '測試線',
        nameEn: 'Test Line',
        color: '#00ff00',
        // Every 6 minutes all day on weekdays → average wait 3 minutes.
        headways: { weekday: [{ start: 0, end: 1440, min: 6, max: 6 }], holiday: [] },
        fallbackHeadwayMin: 10,
        shape: [],
      },
    ],
    patterns: [
      { line: 'T', stations: [0, 1, 2], km: [1, 1] },
      { line: 'T', stations: [2, 1, 0], km: [1, 1] },
    ],
    fares,
  };
}

export function busFixture(): BusData {
  const stops = [
    { id: 101, name: 'P站', ...at(1, 2) },
    { id: 102, name: 'Q站', ...at(1, 1) },
    { id: 103, name: 'R站', ...at(1.05, 0) },
    { id: 104, name: 'S站', ...at(1, -1) },
  ];
  return {
    version: SCHEMA_VERSION,
    generatedAt: '2026-11-04T00:00:00Z',
    sourceUpdatedAt: '2026/11/04 07:00:00',
    attribution: [],
    stops,
    routes: [
      {
        id: 9,
        name: '9',
        from: 'P',
        to: 'S',
        operator: '測試客運',
        fare: { kind: 'segments', segments: 1, buffers: [] },
        // 10–20 min off-peak → 7.5 min average wait.
        headway: { peak: [5, 10], offPeak: [10, 20], holidayPeak: null, holidayOffPeak: null },
        patterns: [
          { dir: 0, stops: [0, 1, 2, 3], etaIds: [9001, 9002, 9003, 9004] },
          { dir: 1, stops: [3, 2, 1, 0], etaIds: [9101, 9102, 9103, 9104] },
        ],
      },
    ],
  };
}
