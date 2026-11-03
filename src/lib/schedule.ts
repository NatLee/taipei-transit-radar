// Expected waiting time from published headways. The open data has headway ranges, not
// timetables, so the planner waits half the gap on average.

import type { BusHeadway, HeadwayTable, MetroLine } from '../data/schema.ts';

export interface Clock {
  /** Minutes since local midnight. */
  minute: number;
  /** Saturday or Sunday. National holidays are not in the open data, so they count as weekdays. */
  holiday: boolean;
}

/** Reads the clock in Taipei time no matter where the visitor's device is set. */
export function taipeiClock(date: Date): Clock {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Taipei',
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short',
    hourCycle: 'h23',
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  const minute = Number(get('hour')) * 60 + Number(get('minute'));
  const weekday = get('weekday');
  return { minute, holiday: weekday === 'Sat' || weekday === 'Sun' };
}

const mid = ([lo, hi]: [number, number]) => (lo + hi) / 2;

/** Typical headway of a metro line right now, and whether it came from the official table. */
export function metroHeadway(line: MetroLine, clock: Clock): { minutes: number; official: boolean } {
  const table: HeadwayTable | null = line.headways;
  const windows = table ? (clock.holiday ? table.holiday : table.weekday) : [];
  const w = windows.find((x) => clock.minute >= x.start && clock.minute < x.end);
  if (w) return { minutes: (w.min + w.max) / 2, official: true };
  return { minutes: line.fallbackHeadwayMin, official: false };
}

export function busHeadway(
  h: BusHeadway,
  clock: Clock,
  peakHours: readonly (readonly [number, number])[],
  fallbackMin: number,
): { minutes: number; official: boolean } {
  const peak = peakHours.some(([s, e]) => clock.minute >= s && clock.minute < e);
  const order = clock.holiday
    ? [peak ? h.holidayPeak : h.holidayOffPeak, h.holidayOffPeak, h.holidayPeak, h.offPeak]
    : [peak ? h.peak : h.offPeak, h.offPeak, h.peak];
  const range = order.find((r): r is [number, number] => r !== null);
  return range ? { minutes: mid(range), official: true } : { minutes: fallbackMin, official: false };
}

export function formatClock(date: Date): string {
  return new Intl.DateTimeFormat('zh-TW', {
    timeZone: 'Asia/Taipei',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(date);
}
