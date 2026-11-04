import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import About from './components/About.tsx';
import Bubbles from './components/Bubbles.tsx';
import { ChevronIcon, LocateIcon, RadarIcon, ShareIcon, SwapIcon } from './components/icons.tsx';
import type { MapPick } from './components/MapView.tsx';
import Nearby from './components/Nearby.tsx';
import PlaceField from './components/PlaceField.tsx';
import TripCard from './components/TripCard.tsx';
import { LIVE } from './config.ts';
import { useLiveFeeds, useNow, useReducedMotion, useStaticData } from './hooks.ts';
import { findNearby, nearestStation, resolvePlace } from './lib/places.ts';
import { planTrips, type OptionKind } from './lib/plan.ts';
import { PRIORITIES, rankOptions, type Priority } from './lib/rank.ts';
import { formatClock, taipeiClock } from './lib/schedule.ts';
import { buildSearchIndex, type SearchEntry } from './lib/search.ts';
import { PLAN_SETTINGS } from './lib/settings.ts';
import { readShareState, writeShareState, type PlaceRef } from './lib/share.ts';

type Role = 'from' | 'to';

const initialShare = readShareState(window.location.search);

// MapLibre is most of the bundle; loading it separately lets the panel show up first.
const MapView = lazy(() => import('./components/MapView.tsx'));

function useIsWide() {
  const [wide, setWide] = useState(() => window.matchMedia('(min-width: 768px)').matches);
  useEffect(() => {
    const m = window.matchMedia('(min-width: 768px)');
    const on = () => setWide(m.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, []);
  return wide;
}

export default function App() {
  const { metro, bus, network, error, busError } = useStaticData();
  const live = useLiveFeeds();
  const now = useNow();
  const reducedMotion = useReducedMotion();
  const wide = useIsWide();

  const [fromRef, setFromRef] = useState<PlaceRef | null>(initialShare.from);
  const [toRef, setToRef] = useState<PlaceRef | null>(initialShare.to);
  const [priority, setPriority] = useState<Priority>(initialShare.by);
  const [pick, setPick] = useState<MapPick | null>(null);
  // Which option is highlighted on the map; null means "the recommended one".
  const [selectedKind, setSelectedKind] = useState<OptionKind | null>(null);
  const [sheetOpen, setSheetOpen] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);

  const origin = useMemo(() => (fromRef && metro ? resolvePlace(fromRef, metro, bus) : null), [fromRef, metro, bus]);
  const destination = useMemo(() => (toRef && metro ? resolvePlace(toRef, metro, bus) : null), [toRef, metro, bus]);

  // Keep the URL in step with the query so it can be shared as-is.
  useEffect(() => {
    const qs = writeShareState({ from: fromRef, to: toRef, by: priority });
    window.history.replaceState(null, '', `${window.location.pathname}${qs}`);
  }, [fromRef, toRef, priority]);

  const index = useMemo(() => (metro ? buildSearchIndex(metro, bus, live.docks ?? []) : []), [metro, bus, live.docks]);

  // Re-plan when the places change or fresh live data arrives (minute resolution is enough).
  const minuteKey = Math.floor(now.getTime() / 60_000);
  const options = useMemo(() => {
    if (!network || !origin || !destination) return [];
    const planned = planTrips(
      network,
      { origin, destination, clock: taipeiClock(new Date(minuteKey * 60_000)), busEtas: live.etas, docks: live.docks },
      PLAN_SETTINGS,
    );
    return rankOptions(planned, priority);
  }, [network, origin, destination, live.etas, live.docks, priority, minuteKey]);

  const selected = Math.max(0, options.findIndex((o) => o.kind === selectedKind));

  const focus = pick ?? destination ?? origin;
  const nearby = useMemo(
    () =>
      network && focus
        ? findNearby(
            network,
            focus,
            { station: LIVE.nearbyStationRadiusM, stop: LIVE.nearbyStopRadiusM, dock: LIVE.nearbyDockRadiusM },
            live.etas,
            live.docks,
          )
        : null,
    [network, focus, live.etas, live.docks],
  );

  const choose = useCallback((role: Role, ref: PlaceRef) => {
    (role === 'from' ? setFromRef : setToRef)(ref);
    setSelectedKind(null);
    setPick(null);
    setSheetOpen(true);
  }, []);

  const fromEntry = (role: Role) => (e: SearchEntry) => choose(role, e.ref);

  const pickRef = (p: MapPick): PlaceRef =>
    p.ref ?? { kind: 'point', lat: p.lat, lon: p.lon, label: p.name ?? '地圖上的點' };

  const onMapPick = useCallback(
    (p: MapPick) => {
      // First tap fills whatever is empty; after that, offer a choice.
      if (!fromRef) return choose('from', pickRef(p));
      if (!toRef) return choose('to', pickRef(p));
      setPick(p);
      setSheetOpen(true);
    },
    [fromRef, toRef, choose],
  );

  const locate = () => {
    if (!('geolocation' in navigator)) return setNotice('這個瀏覽器不支援定位。');
    setNotice('定位中…');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const p = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        const near = metro ? nearestStation(metro, p) : null;
        setNotice(near ? `最近的捷運站：${near.station.name}（約 ${Math.round(near.meters)} 公尺）` : null);
        choose('from', { kind: 'point', ...p, label: '目前位置' });
      },
      (err) => setNotice(`定位失敗：${err.message || '請允許瀏覽器使用位置'}`),
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  };

  const share = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setNotice('已複製分享連結。');
    } catch {
      setNotice(`分享連結：${window.location.href}`);
    }
  };

  const panelPadding = wide
    ? { top: 24, right: 24, bottom: 24, left: 440 }
    : { top: 24, right: 24, bottom: sheetOpen ? Math.round(window.innerHeight * 0.5) : 80, left: 24 };

  const trip = options[selected] ?? null;
  const pickLabel = pick ? (pick.name ?? `${pick.lat.toFixed(4)}, ${pick.lon.toFixed(4)}`) : '';

  return (
    <div className="scanlines relative h-full overflow-hidden bg-void">
      <Suspense fallback={<p className="absolute inset-0 grid place-items-center font-mono text-cyan">LOADING MAP…</p>}>
        <MapView
          metro={metro}
          bus={bus}
          docks={live.docks}
          origin={origin}
          destination={destination}
          trip={trip}
          pick={pick}
          reducedMotion={reducedMotion}
          padding={panelPadding}
          onPick={onMapPick}
        />
      </Suspense>

      {/* Top-right HUD: clock and feed status. */}
      <div className="hud-panel pointer-events-none absolute top-3 right-3 z-20 hidden rounded px-3 py-2 font-mono text-[11px] leading-5 md:block">
        <div className="text-cyan glow-text">
          TPE {formatClock(now)} <span className="blink">▮</span>
        </div>
        <div className={live.etas ? 'text-lime' : 'text-dim'}>● BUS LIVE {live.etasAt.slice(11, 16) || '…'}</div>
        <div className={live.docks ? 'text-lime' : 'text-dim'}>● YOUBIKE {live.docksAt ? formatClock(live.docksAt) : '…'}</div>
      </div>

      <aside
        className={`hud-panel absolute z-10 flex flex-col overflow-hidden md:top-3 md:bottom-3 md:left-3 md:w-[410px] md:rounded-lg ${
          sheetOpen ? 'inset-x-0 bottom-0 max-h-[62%] rounded-t-xl' : 'inset-x-0 bottom-0 max-h-14 rounded-t-xl'
        } md:max-h-none`}
        aria-label="轉乘查詢"
      >
        <header className="flex items-center gap-2 border-b border-cyan/15 px-4 py-3">
          <RadarIcon className="text-2xl text-cyan" />
          <div className="min-w-0">
            <h1 className="font-mono text-sm font-bold tracking-[0.18em] text-cyan glow-text">TAIPEI TRANSIT RADAR</h1>
            <p className="text-xs text-dim">大台北即時轉乘雷達 · 2016 IISI Hackathon → 2026</p>
          </div>
          <button
            type="button"
            className="ml-auto rounded p-2 text-dim hover:text-cyan md:hidden"
            onClick={() => setSheetOpen((o) => !o)}
            aria-expanded={sheetOpen}
            aria-label={sheetOpen ? '收起面板' : '展開面板'}
          >
            <ChevronIcon className={sheetOpen ? '' : 'rotate-180'} />
          </button>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
          {error ? <p className="rounded border border-amber/60 p-2 text-sm text-amber">捷運資料載入失敗：{error}</p> : null}
          {busError ? <p className="text-xs text-amber">公車路網沒有載入，只會規劃捷運、步行和 YouBike。</p> : null}

          <div className="flex gap-2">
            <div className="flex-1 space-y-2">
              <PlaceField
                label="FROM 起點"
                accent="cyan"
                value={origin}
                index={index}
                onChoose={fromEntry('from')}
                onClear={() => setFromRef(null)}
              />
              <PlaceField
                label="TO 終點"
                accent="magenta"
                value={destination}
                index={index}
                onChoose={fromEntry('to')}
                onClear={() => setToRef(null)}
              />
            </div>
            <div className="flex flex-col justify-center gap-2 pt-4">
              <button
                type="button"
                className="rounded border border-edge p-2 text-cyan hover:border-cyan/60"
                onClick={locate}
                title="用目前位置當起點"
                aria-label="用目前位置當起點"
              >
                <LocateIcon />
              </button>
              <button
                type="button"
                className="rounded border border-edge p-2 text-cyan hover:border-cyan/60"
                onClick={() => {
                  setFromRef(toRef);
                  setToRef(fromRef);
                }}
                title="起點終點對調"
                aria-label="起點終點對調"
              >
                <SwapIcon />
              </button>
            </div>
          </div>

          {notice ? (
            <p className="text-xs text-amber" role="status">
              {notice}
            </p>
          ) : null}

          {pick ? (
            <div className="rounded border border-amber/50 bg-amber/5 p-3 text-sm">
              <div className="mb-2 font-mono text-[11px] tracking-widest text-amber">TARGET · {pickLabel}</div>
              <div className="flex gap-2">
                <button type="button" className="rounded bg-cyan px-3 py-1 text-void" onClick={() => choose('from', pickRef(pick))}>
                  設為起點
                </button>
                <button type="button" className="rounded bg-magenta px-3 py-1 text-void" onClick={() => choose('to', pickRef(pick))}>
                  設為終點
                </button>
                <button type="button" className="ml-auto text-dim hover:text-ink" onClick={() => setPick(null)}>
                  取消
                </button>
              </div>
            </div>
          ) : null}

          <div role="radiogroup" aria-label="排序方式" className="grid grid-cols-3 gap-1 rounded border border-edge p-1">
            {PRIORITIES.map((p) => (
              <button
                key={p.id}
                type="button"
                role="radio"
                aria-checked={priority === p.id}
                onClick={() => {
                  setPriority(p.id);
                  setSelectedKind(null);
                }}
                className={`rounded py-1.5 text-sm ${priority === p.id ? 'bg-cyan/15 text-cyan glow-text' : 'text-dim hover:text-ink'}`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {origin && destination ? (
            options.length ? (
              <>
                <div className="flex items-center font-mono text-[11px] tracking-[0.2em] text-cyan">
                  SCAN RESULT · {options.length} 種走法
                  <button type="button" onClick={share} className="ml-auto flex items-center gap-1 text-dim hover:text-cyan">
                    <ShareIcon /> 分享
                  </button>
                </div>
                <ul className="space-y-2">
                  {options.map((o, i) => (
                    <TripCard
                      key={o.kind}
                      option={o}
                      now={now}
                      recommended={i === 0}
                      selected={i === selected}
                      onSelect={() => setSelectedKind(o.kind)}
                    />
                  ))}
                </ul>
                <Bubbles options={options} selected={selected} />
              </>
            ) : (
              <p className="font-mono text-sm text-cyan">{network ? 'NO ROUTE · 找不到路線' : 'SCANNING… 載入路網中'}</p>
            )
          ) : (
            <p className="text-sm leading-relaxed text-dim">
              點地圖、搜尋站名，或按 <LocateIcon className="inline text-cyan" /> 用目前位置，選好<span className="text-cyan">起點</span>
              和<span className="text-magenta">終點</span>。雷達會比較步行、公車、捷運、捷運＋公車和 YouBike 哪個最快、最省錢、走最短。
            </p>
          )}

          {nearby && metro && focus ? (
            <Nearby
              title={pick ? pickLabel : (destination ?? origin)!.name}
              result={nearby}
              metro={metro}
              liveReady={!!live.etas}
            />
          ) : null}
          {live.error ? <p className="text-xs text-amber">{live.error}</p> : null}

          <About metro={metro} bus={bus} />
        </div>
      </aside>
    </div>
  );
}
