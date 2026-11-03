import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { LIVE, SOURCES, TRAVEL } from './config.ts';
import type { BusData, MetroData } from './data/schema.ts';
import { cached, fetchBusEtas, fetchDocks } from './lib/live.ts';
import { buildNetwork, type Network } from './lib/network.ts';
import { loadData } from './lib/places.ts';
import type { BusEtas, Dock } from './lib/plan.ts';

const dataUrl = (file: string) => `${import.meta.env.BASE_URL}data/${file}`;

export interface StaticData {
  metro: MetroData | null;
  bus: BusData | null;
  network: Network | null;
  error: string | null;
  busError: string | null;
}

/** Loads the MRT network (required) and the bus network (optional: the app still works without it). */
export function useStaticData(): StaticData {
  const [metro, setMetro] = useState<MetroData | null>(null);
  const [bus, setBus] = useState<BusData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busError, setBusError] = useState<string | null>(null);
  const [busSettled, setBusSettled] = useState(false);

  useEffect(() => {
    let alive = true;
    loadData<MetroData>(dataUrl('metro.json'))
      .then((d) => alive && setMetro(d))
      .catch((e: unknown) => alive && setError(String(e)));
    loadData<BusData>(dataUrl('bus.json'))
      .then((d) => alive && setBus(d))
      .catch((e: unknown) => alive && setBusError(String(e)))
      .finally(() => alive && setBusSettled(true));
    return () => {
      alive = false;
    };
  }, []);

  const network = useMemo(
    () =>
      metro && busSettled
        ? buildNetwork(metro, bus, { transferRadiusM: TRAVEL.transferRadiusM, busDetour: TRAVEL.busDetour })
        : null,
    [metro, bus, busSettled],
  );
  return { metro, bus, network, error, busError };
}

export interface LiveState {
  etas: BusEtas | null;
  etasAt: string;
  docks: Dock[] | null;
  docksAt: Date | null;
  error: string | null;
}

const getEtas = cached(() => fetchBusEtas(SOURCES.busEstimates), LIVE.busTtlMs);
const getDocks = cached(() => fetchDocks(SOURCES.youbike), LIVE.youbikeTtlMs);

/** Polls the live feeds while the page is visible. */
export function useLiveFeeds(): LiveState {
  const [state, setState] = useState<LiveState>({ etas: null, etasAt: '', docks: null, docksAt: null, error: null });
  useEffect(() => {
    let alive = true;
    const tick = () => {
      if (document.hidden) return;
      getEtas()
        .then(({ etas, updatedAt }) => alive && setState((s) => ({ ...s, etas, etasAt: updatedAt, error: null })))
        .catch((e: unknown) => alive && setState((s) => ({ ...s, error: `公車即時資料：${String(e)}` })));
      getDocks()
        .then((docks) => alive && setState((s) => ({ ...s, docks, docksAt: new Date() })))
        .catch((e: unknown) => alive && setState((s) => ({ ...s, error: `YouBike 即時資料：${String(e)}` })));
    };
    tick();
    const id = window.setInterval(tick, LIVE.busTtlMs);
    document.addEventListener('visibilitychange', tick);
    return () => {
      alive = false;
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
    };
  }, []);
  return state;
}

const motionQuery = '(prefers-reduced-motion: reduce)';
export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(motionQuery);
      m.addEventListener('change', cb);
      return () => m.removeEventListener('change', cb);
    },
    () => window.matchMedia(motionQuery).matches,
    () => false,
  );
}

/** Re-renders every `ms` so clocks and "updated n min ago" stay current. */
export function useNow(ms = 15_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), ms);
    return () => window.clearInterval(id);
  }, [ms]);
  return now;
}
