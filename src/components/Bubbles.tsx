import type { TripOption } from '../lib/plan.ts';
import { bubbleRadii, METRICS, metricValue, OPTION_LABEL } from '../lib/rank.ts';

const MAX_R = 26;
const MIN_R = 3;
const CELL = 2 * MAX_R + 8;

/** 2016's "泡泡比一比": one row per measure, bubble area proportional to the value. */
export default function Bubbles({ options, selected }: { options: TripOption[]; selected: number }) {
  const width = options.length * CELL;
  return (
    <figure className="space-y-2" aria-label="泡泡比一比：各種走法的耗時、距離、花費">
      {METRICS.map((m) => {
        const values = options.map((o) => metricValue(o, m.id));
        const radii = bubbleRadii(values, MAX_R, MIN_R);
        return (
          <div key={m.id}>
            <div className="font-mono text-[10px] tracking-widest text-dim">
              {m.label}（{m.unit}，泡泡越大越多）
            </div>
            <div className="overflow-x-auto">
              <svg width={width} height={CELL + 16} role="img" aria-label={m.label}>
                {options.map((o, i) => {
                  const r = radii[i];
                  const v = values[i] ?? null;
                  const cx = i * CELL + CELL / 2;
                  const on = i === selected;
                  return (
                    <g key={o.kind}>
                      <title>
                        {OPTION_LABEL[o.kind]}：{v === null ? '未知' : `${Math.round(v * 10) / 10} ${m.unit}`}
                      </title>
                      {r === null ? (
                        <text x={cx} y={CELL / 2 + 4} textAnchor="middle" className="fill-dim font-mono text-[10px]">
                          ?
                        </text>
                      ) : (
                        <circle
                          cx={cx}
                          cy={CELL / 2}
                          r={r}
                          fill={on ? 'rgb(46 242 255 / 0.25)' : 'rgb(46 242 255 / 0.08)'}
                          stroke={on ? '#2ef2ff' : 'rgb(46 242 255 / 0.45)'}
                          strokeWidth={on ? 2 : 1}
                        />
                      )}
                      <text x={cx} y={CELL + 12} textAnchor="middle" className="fill-ink text-[10px]">
                        {OPTION_LABEL[o.kind]}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>
        );
      })}
    </figure>
  );
}
