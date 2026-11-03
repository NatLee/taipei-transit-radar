// Checks the committed MRT network (public/data/metro.json) the way a rider would.
// If one of these fails after `npm run data:metro`, look at the diff before committing it.

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SCHEMA_VERSION, type MetroData } from '../data/schema.ts';
import { metroFare } from './fares.ts';
import { buildNetwork } from './network.ts';
import { planTrips, type RideStep } from './plan.ts';
import { PLAN_SETTINGS } from './settings.ts';

const metro = JSON.parse(readFileSync(new URL('../../public/data/metro.json', import.meta.url), 'utf8')) as MetroData;
const station = (name: string) => metro.stations.find((s) => s.name === name)!;
const idx = (name: string) => metro.stations.indexOf(station(name));

describe('committed metro.json', () => {
  it('matches the schema this app reads', () => {
    expect(metro.version).toBe(SCHEMA_VERSION);
  });

  it('has every Taipei Metro line and the 2026 Xinyi extension', () => {
    expect(metro.lines.map((l) => l.code).sort()).toEqual(['BL', 'BR', 'G', 'G03A', 'O', 'R', 'R22A', 'Y']);
    expect(station('廣慈/奉天宮').lines).toContain('R');
    // 119 stations in the September 2026 fare table.
    expect(metro.stations.length).toBeGreaterThanOrEqual(119);
  });

  it('knows the transfer stations', () => {
    expect(station('台北車站').codes).toEqual(['BL12', 'R10']);
    expect(station('大坪林').lines.sort()).toEqual(['G', 'Y']);
  });

  it('has the official fares (Taipei Main Station → Tamsui is NT$50)', () => {
    expect(metroFare(metro, idx('台北車站'), idx('淡水'))).toEqual({ min: 50, max: 50 });
  });

  it('runs every line in both directions', () => {
    for (const line of metro.lines) {
      const patterns = metro.patterns.filter((p) => p.line === line.code);
      for (const p of patterns) {
        const back = [...p.stations].reverse().join(',');
        expect(patterns.some((q) => q.stations.join(',') === back)).toBe(true);
      }
    }
  });
});

describe('planning on the real MRT network', () => {
  const net = buildNetwork(metro, null, { transferRadiusM: 300, busDetour: 1.2 });
  const plan = (from: string, to: string) =>
    planTrips(
      net,
      { origin: { ...station(from), name: from }, destination: { ...station(to), name: to }, clock: { minute: 600, holiday: false } },
      PLAN_SETTINGS,
    );

  it('Tamsui → Taipei Zoo changes once, at Daan, for one NT$65 fare', () => {
    const metroOption = plan('淡水', '動物園').find((o) => o.kind === 'metro')!;
    const rides = metroOption.steps.filter((s): s is RideStep => s.kind === 'ride');
    expect(rides.map((r) => r.name)).toEqual(['淡水信義線', '文湖線']);
    expect(rides[0]!.to.name).toBe('大安');
    expect(metroOption.fare).toEqual({ min: 65, max: 65 });
    // The real trip takes about 70 minutes; the estimate should be in that neighbourhood.
    expect(metroOption.minutes).toBeGreaterThan(55);
    expect(metroOption.minutes).toBeLessThan(90);
  });

  it('Taipei Main Station → Taipei 101 rides the red line straight through', () => {
    const rides = plan('台北車站', '台北101/世貿')
      .find((o) => o.kind === 'metro')!
      .steps.filter((s): s is RideStep => s.kind === 'ride');
    expect(rides.map((r) => r.name)).toEqual(['淡水信義線']);
  });
});
