import { etaLabel } from '../lib/live.ts';
import { stationLabel, type NearbyResult } from '../lib/places.ts';
import type { MetroData } from '../data/schema.ts';

interface Props {
  title: string;
  result: NearbyResult;
  metro: MetroData;
  liveReady: boolean;
}

const M = (m: number) => `${Math.round(m)} m`;

/** What is around a place: MRT stations, bus stops with live arrivals, YouBike docks. */
export default function Nearby({ title, result, metro, liveReady }: Props) {
  const lineColor = (code: string) => metro.lines.find((l) => l.code === code)?.color ?? '#2ef2ff';
  return (
    <section aria-label={`${title}附近`} className="space-y-3 text-sm">
      <h3 className="font-mono text-[11px] tracking-[0.2em] text-cyan">NEARBY · {title}附近</h3>
      {result.stations.length ? (
        <ul className="space-y-1">
          {result.stations.slice(0, 4).map(({ station, meters }) => (
            <li key={station.id} className="flex items-center gap-2">
              {station.lines.map((l) => (
                <span key={l} className="h-2.5 w-2.5 rounded-full" style={{ background: lineColor(l) }} aria-hidden />
              ))}
              <span>{stationLabel(station.name)}</span>
              <span className="ml-auto font-mono text-xs text-dim">{M(meters)}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {result.stops.length ? (
        <ul className="space-y-2">
          {result.stops.slice(0, 4).map((s) => (
            <li key={s.stopIndex}>
              <div className="flex items-baseline gap-2">
                <span className="text-magenta">{s.name}</span>
                <span className="ml-auto font-mono text-xs text-dim">{M(s.meters)}</span>
              </div>
              <ul className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5 font-mono text-xs">
                {s.routes.slice(0, 8).map((r, i) => (
                  <li key={`${r.route}-${r.headsign}-${i}`} className="flex gap-1">
                    <span className="truncate">
                      {r.route}
                      <span className="text-dim"> 往{r.headsign}</span>
                    </span>
                    <span
                      className={`ml-auto shrink-0 ${r.eta !== undefined && r.eta >= 0 ? 'text-lime' : 'text-dim'}`}
                    >
                      {liveReady ? etaLabel(r.eta) : '…'}
                    </span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      ) : null}
      {result.docks.length ? (
        <ul className="space-y-1">
          {result.docks.slice(0, 3).map((d) => (
            <li key={d.id} className="flex items-baseline gap-2">
              <span className="font-mono text-[10px] text-lime">BIKE</span>
              <span className="truncate">{d.name}</span>
              <span className="ml-auto shrink-0 font-mono text-xs">
                <span className="text-lime">{d.bikes}</span>
                <span className="text-dim"> 車 / </span>
                {d.slots}
                <span className="text-dim"> 位 · {M(d.meters)}</span>
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      {!result.stations.length && !result.stops.length && !result.docks.length ? (
        <p className="text-dim">這附近沒有捷運站、公車站或 YouBike。</p>
      ) : null}
    </section>
  );
}
