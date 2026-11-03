import { useId, useMemo, useState } from 'react';
import { search, type SearchEntry } from '../lib/search.ts';
import type { ChosenPlace } from '../lib/places.ts';
import { CloseIcon } from './icons.tsx';

interface Props {
  label: string;
  accent: 'cyan' | 'magenta';
  value: ChosenPlace | null;
  index: SearchEntry[];
  onChoose: (e: SearchEntry) => void;
  onClear: () => void;
}

const KIND_TAG: Record<SearchEntry['kind'], string> = { station: 'MRT', busStop: 'BUS', dock: 'BIKE', point: 'PIN' };

/** Combobox: type a station, stop or YouBike dock; arrow keys + Enter pick a result. */
export default function PlaceField({ label, accent, value, index, onChoose, onClear }: Props) {
  const id = useId();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const results = useMemo(() => search(index, query), [index, query]);
  const color = accent === 'cyan' ? 'text-cyan border-cyan/40' : 'text-magenta border-magenta/40';

  const choose = (e: SearchEntry) => {
    onChoose(e);
    setQuery('');
    setOpen(false);
  };

  return (
    <div className="relative">
      <label htmlFor={id} className={`mb-1 block font-mono text-[11px] tracking-[0.2em] ${color.split(' ')[0]}`}>
        {label}
      </label>
      {value && !open ? (
        <div className={`flex items-center gap-2 rounded border bg-void/70 px-3 py-2 ${color}`}>
          <button
            type="button"
            className="min-w-0 flex-1 truncate text-left text-ink"
            onClick={() => setOpen(true)}
            aria-label={`${label}：${value.name}，按一下重新搜尋`}
          >
            {value.name}
          </button>
          <button type="button" onClick={onClear} className="text-dim hover:text-ink" aria-label={`清除${label}`}>
            <CloseIcon />
          </button>
        </div>
      ) : (
        <input
          id={id}
          role="combobox"
          aria-expanded={open && results.length > 0}
          aria-controls={`${id}-list`}
          aria-autocomplete="list"
          autoComplete="off"
          autoFocus={open && !!value}
          placeholder="搜尋捷運站、公車站、YouBike，或點地圖"
          className={`w-full rounded border bg-void/70 px-3 py-2 text-ink placeholder:text-dim/70 focus:outline-none focus:ring-1 focus:ring-cyan ${color}`}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setActive((a) => Math.min(a + 1, results.length - 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            } else if (e.key === 'Enter' && results[active]) {
              e.preventDefault();
              choose(results[active]);
            } else if (e.key === 'Escape') setOpen(false);
          }}
        />
      )}
      {open && results.length > 0 ? (
        <ul
          id={`${id}-list`}
          role="listbox"
          className="hud-panel absolute z-30 mt-1 max-h-72 w-full overflow-auto rounded py-1 shadow-xl shadow-black/60"
        >
          {results.map((r, i) => (
            <li
              key={`${r.kind}-${r.name}-${r.lat}`}
              role="option"
              aria-selected={i === active}
              className={`flex cursor-pointer items-baseline gap-2 px-3 py-1.5 ${i === active ? 'bg-cyan/10' : ''}`}
              onMouseDown={(e) => {
                e.preventDefault();
                choose(r);
              }}
              onMouseEnter={() => setActive(i)}
            >
              <span className="w-10 shrink-0 font-mono text-[10px] text-cyan/80">{KIND_TAG[r.kind]}</span>
              <span className="truncate text-ink">{r.name}</span>
              <span className="ml-auto shrink-0 truncate text-xs text-dim">{r.detail}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
