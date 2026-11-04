import { describe, expect, it } from 'vitest';
import type { MetroLine } from '../data/schema.ts';
import { busHeadway, formatClock, metroHeadway, taipeiClock } from './schedule.ts';

describe('taipeiClock', () => {
  it('reads the time in Taipei regardless of the device time zone', () => {
    // 2026-11-04 is a Wednesday; 01:30 UTC is 09:30 in Taipei (UTC+8).
    expect(taipeiClock(new Date('2026-11-04T01:30:00Z'))).toEqual({ minute: 9 * 60 + 30, holiday: false });
    // 2026-11-07 is a Saturday.
    expect(taipeiClock(new Date('2026-11-07T04:00:00Z')).holiday).toBe(true);
  });
  it('formats a 24-hour clock', () => {
    expect(formatClock(new Date('2026-11-04T13:05:00Z'))).toBe('21:05');
  });
});

describe('metroHeadway', () => {
  const line: MetroLine = {
    code: 'BR',
    name: '文湖線',
    nameEn: 'Wenhu',
    color: '#c48c31',
    headways: {
      weekday: [
        { start: 420, end: 540, min: 2, max: 4 },
        { start: 540, end: 1020, min: 4, max: 10 },
      ],
      holiday: [],
    },
    fallbackHeadwayMin: 10,
    shape: [],
  };
  it('uses the official window for the current time', () => {
    expect(metroHeadway(line, { minute: 8 * 60, holiday: false })).toEqual({ minutes: 3, official: true });
    expect(metroHeadway(line, { minute: 12 * 60, holiday: false })).toEqual({ minutes: 7, official: true });
  });
  it('falls back to the line default outside the table', () => {
    expect(metroHeadway(line, { minute: 12 * 60, holiday: true })).toEqual({ minutes: 10, official: false });
    expect(metroHeadway({ ...line, headways: null }, { minute: 480, holiday: false })).toEqual({ minutes: 10, official: false });
  });
});

describe('busHeadway', () => {
  const peaks: [number, number][] = [[420, 540]];
  const h = { peak: [5, 10] as [number, number], offPeak: [10, 20] as [number, number], holidayPeak: null, holidayOffPeak: null };
  it('picks peak or off-peak by the clock', () => {
    expect(busHeadway(h, { minute: 480, holiday: false }, peaks, 15)).toEqual({ minutes: 7.5, official: true });
    expect(busHeadway(h, { minute: 720, holiday: false }, peaks, 15)).toEqual({ minutes: 15, official: true });
  });
  it('uses weekday values on holidays when the holiday ones are blank', () => {
    expect(busHeadway(h, { minute: 720, holiday: true }, peaks, 15)).toEqual({ minutes: 15, official: true });
  });
  it('falls back when the feed has nothing', () => {
    const none = { peak: null, offPeak: null, holidayPeak: null, holidayOffPeak: null };
    expect(busHeadway(none, { minute: 720, holiday: false }, peaks, 12)).toEqual({ minutes: 12, official: false });
  });
});
