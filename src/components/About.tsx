import { PROJECT } from '../config.ts';
import type { BusData, MetroData } from '../data/schema.ts';

/** Credits, the 2016 origin story, and where every number on the page comes from. */
export default function About({ metro, bus }: { metro: MetroData | null; bus: BusData | null }) {
  const day = (iso: string | undefined) => (iso ? iso.slice(0, 10) : '—');
  return (
    <section className="space-y-3 text-xs leading-relaxed text-dim" aria-label="關於這個網站">
      <blockquote className="border-l-2 border-magenta pl-3 text-ink/90">
        2016 年資拓宏宇（IISI）黑客松第三隊的作品「最即時的大眾運輸比較系統」，2026 年用 React、Tailwind 和開放資料重寫。
        <br />
        <span className="text-dim">「今天解決不了的事 別急 明天也解決不了」</span>
      </blockquote>
      <p>
        2016 年團隊：李映澤、楊昌憲、王昱程。原始程式大多由{' '}
        <a className="text-cyan underline" href={`https://github.com/${PROJECT.teammate}`} target="_blank" rel="noreferrer">
          @{PROJECT.teammate}
        </a>{' '}
        寫成。<a className="text-cyan underline" href={`${PROJECT.repoUrl}/${PROJECT.deckPath}`} target="_blank" rel="noreferrer">2016 年的簡報內容</a>
      </p>
      <p>
        資料：捷運路網 {day(metro?.generatedAt)}，公車路線 {day(bus?.generatedAt)}。時間是估計值：捷運用官方班距，公車優先用即時到站；票價為單程全票，不含轉乘優惠和月票。
      </p>
      <ul className="list-disc space-y-0.5 pl-4">
        {[...(metro?.attribution ?? []), ...(bus?.attribution ?? [])].map((a) => (
          <li key={a}>{a}</li>
        ))}
        <li>YouBike 2.0 即時車位：臺北市政府交通局（政府資料開放授權條款－第1版）</li>
        <li>底圖：OpenFreeMap © OpenMapTiles，資料 © OpenStreetMap contributors</li>
      </ul>
      <p>
        <a className="text-cyan underline" href={PROJECT.repoUrl} target="_blank" rel="noreferrer">
          原始碼（Apache-2.0）
        </a>
      </p>
    </section>
  );
}
