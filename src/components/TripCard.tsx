import { formatFare } from '../lib/fares.ts';
import type { Step, TripOption } from '../lib/plan.ts';
import { OPTION_LABEL } from '../lib/rank.ts';
import { formatClock } from '../lib/schedule.ts';
import { BikeIcon, BusIcon, MetroIcon, MixIcon, WalkIcon } from './icons.tsx';

const KIND_ICON = { walk: WalkIcon, bus: BusIcon, metro: MetroIcon, mixed: MixIcon, youbike: BikeIcon };

const WAIT_NOTE = { live: '即時', timetable: '依班距', estimate: '估計' } as const;

const min = (v: number) => Math.max(1, Math.round(v));
const km = (v: number) => (v < 10 ? v.toFixed(1) : Math.round(v).toString());

function StepChip({ step }: { step: Step }) {
  if (step.kind === 'walk') return <WalkIcon className="text-dim" title={`步行 ${min(step.minutes)} 分`} />;
  if (step.kind === 'bike') return <BikeIcon className="text-lime" title="YouBike" />;
  const style = step.mode === 'metro' ? { borderColor: step.color, color: step.color } : undefined;
  return (
    <span
      className={`rounded-sm border px-1.5 py-px font-mono text-[11px] leading-4 ${step.mode === 'bus' ? 'border-magenta text-magenta' : ''}`}
      style={style}
    >
      {step.name}
    </span>
  );
}

function StepLine({ step }: { step: Step }) {
  if (step.kind === 'walk')
    return (
      <li className="flex gap-2 text-dim">
        <WalkIcon className="mt-1 shrink-0" />
        <span>
          步行 {Math.round(step.meters)} 公尺 · {min(step.minutes)} 分
          <span className="block text-xs">到 {step.to.name}</span>
        </span>
      </li>
    );
  if (step.kind === 'bike')
    return (
      <li className="flex gap-2">
        <BikeIcon className="mt-1 shrink-0 text-lime" />
        <span>
          YouBike {step.from.name} → {step.to.name}
          <span className="block text-xs text-dim">
            {km(step.km)} 公里 · {min(step.minutes)} 分 · 借車站剩 {step.bikesAtStart} 輛 · 還車站有 {step.slotsAtEnd} 位
          </span>
        </span>
      </li>
    );
  const Icon = step.mode === 'metro' ? MetroIcon : BusIcon;
  return (
    <li className="flex gap-2">
      <Icon className="mt-1 shrink-0" style={{ color: step.mode === 'metro' ? step.color : 'var(--color-magenta)' }} />
      <span>
        <b className="font-medium">{step.name}</b> 往{step.headsign}
        <span className="block text-xs text-dim">
          {step.from.name} → {step.to.name} · {step.stopCount} 站 · 乘車 {min(step.rideMin)} 分
        </span>
        <span className={`block text-xs ${step.waitSource === 'live' ? 'text-lime' : 'text-dim'}`}>
          {step.accessMin > 0 ? `進站 ${min(step.accessMin)} 分 · ` : ''}等車約 {Math.round(step.waitMin)} 分（
          {WAIT_NOTE[step.waitSource]}）
        </span>
      </span>
    </li>
  );
}

interface Props {
  option: TripOption;
  now: Date;
  recommended: boolean;
  selected: boolean;
  onSelect: () => void;
}

/** One way to get there: the 2016 "超級比一比" row, now with every leg spelled out. */
export default function TripCard({ option, now, recommended, selected, onSelect }: Props) {
  const Icon = KIND_ICON[option.kind];
  const arrive = new Date(now.getTime() + option.minutes * 60_000);
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        className={`w-full rounded border p-3 text-left transition-colors ${
          selected ? 'glow-box border-cyan/60 bg-cyan/5' : 'border-edge bg-void/40 hover:border-cyan/40'
        }`}
      >
        <div className="flex items-center gap-2">
          <Icon className="text-lg text-cyan" />
          <span className="font-medium">{OPTION_LABEL[option.kind]}</span>
          {recommended ? (
            <span className="rounded-sm bg-cyan px-1.5 font-mono text-[10px] font-bold tracking-widest text-void">推薦</span>
          ) : null}
          {option.live ? <span className="font-mono text-[10px] tracking-widest text-lime">● LIVE</span> : null}
          <span className="ml-auto font-mono text-2xl leading-none tabular-nums glow-text">
            {min(option.minutes)}
            <span className="ml-0.5 text-xs text-dim">分</span>
          </span>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {option.steps.map((s, i) => (
            <StepChip key={i} step={s} />
          ))}
        </div>
        <dl className="mt-2 grid grid-cols-4 gap-1 font-mono text-xs tabular-nums">
          <div>
            <dt className="text-[10px] text-dim">抵達</dt>
            <dd>{formatClock(arrive)}</dd>
          </div>
          <div>
            <dt className="text-[10px] text-dim">距離</dt>
            <dd>{km(option.km)} km</dd>
          </div>
          <div>
            <dt className="text-[10px] text-dim">票價</dt>
            <dd>{formatFare(option.fare)}</dd>
          </div>
          <div>
            <dt className="text-[10px] text-dim">熱量</dt>
            <dd>{Math.round(option.kcal)} 大卡</dd>
          </div>
        </dl>
      </button>
      {selected ? (
        <ol className="mt-2 space-y-2 border-l border-cyan/30 pl-3 text-sm">
          {option.steps.map((s, i) => (
            <StepLine key={i} step={s} />
          ))}
        </ol>
      ) : null}
    </li>
  );
}
