// Ordering options by what the rider cares about (2016's "最省錢／最省時／走最短"), and the
// numbers behind the bubble comparison (2016's "泡泡比一比").

import type { OptionKind, TripOption } from './plan.ts';

export type Priority = 'time' | 'money' | 'distance';

export const PRIORITIES: { id: Priority; label: string }[] = [
  { id: 'time', label: '最省時' },
  { id: 'money', label: '最省錢' },
  { id: 'distance', label: '走最短' },
];

export const OPTION_LABEL: Record<OptionKind, string> = {
  walk: '步行',
  bus: '公車',
  metro: '捷運',
  mixed: '捷運＋公車',
  youbike: 'YouBike',
};

/** Unknown fares sort last when saving money is the goal. */
const fareKey = (o: TripOption) => (o.fare ? o.fare.max : Infinity);

const KEYS: Record<Priority, (o: TripOption) => number> = {
  time: (o) => o.minutes,
  money: fareKey,
  distance: (o) => o.km,
};

export function rankOptions(options: readonly TripOption[], priority: Priority): TripOption[] {
  const key = KEYS[priority];
  return [...options].sort((a, b) => key(a) - key(b) || a.minutes - b.minutes);
}

export type Metric = 'minutes' | 'km' | 'fare';

export const METRICS: { id: Metric; label: string; unit: string }[] = [
  { id: 'minutes', label: '總耗時', unit: '分' },
  { id: 'km', label: '總距離', unit: '公里' },
  { id: 'fare', label: '總花費', unit: '元' },
];

export function metricValue(o: TripOption, m: Metric): number | null {
  if (m === 'minutes') return o.minutes;
  if (m === 'km') return o.km;
  return o.fare ? o.fare.max : null;
}

/**
 * Bubble radii for one metric, area proportional to the value (so a trip twice as long looks
 * twice as big, not four times). Zero still gets a visible dot; unknown values get none.
 */
export function bubbleRadii(values: readonly (number | null)[], maxRadius: number, minRadius: number): (number | null)[] {
  const max = Math.max(0, ...values.filter((v): v is number => v !== null));
  return values.map((v) => {
    if (v === null) return null;
    if (max === 0) return minRadius;
    return Math.max(minRadius, maxRadius * Math.sqrt(v / max));
  });
}
