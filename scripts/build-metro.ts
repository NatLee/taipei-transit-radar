// Builds public/data/metro.json (committed) from OpenStreetMap and data.taipei.
// The MRT network changes about once a year, so this runs by hand when a line or station opens,
// and the result is reviewed as a normal diff. Usage: npm run data:metro

import { fileURLToPath } from 'node:url';
import { MAP, SOURCES } from '../src/config.ts';
import { transformMetro, type MetroSources, type OsmElement } from '../src/data/transformMetro.ts';
import { fetchWithRetry, writeJson } from './lib.ts';
import { METRO_LINES } from './metro-lines.ts';

const out = fileURLToPath(new URL('../public/data/metro.json', import.meta.url));
const [[west, south], [east, north]] = MAP.bounds;
const bbox = `${south},${west},${north},${east}`;
const query = [
  '[out:json][timeout:180];',
  `relation["type"="route"]["route"~"^(subway|light_rail|monorail)$"](${bbox})->.routes;`,
  '.routes out body;',
  'node(r.routes);out body;',
  'way(r.routes);out geom;',
  `node["railway"="station"]["station"~"^(subway|light_rail|monorail)$"](${bbox});out body;`,
].join('\n');

console.log('Fetching OpenStreetMap routes (Overpass)…');
const osmRes = await fetchWithRetry(SOURCES.overpass, {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({ data: query }),
});
const osm = ((await osmRes.json()) as { elements: OsmElement[] }).elements;

console.log('Fetching data.taipei fare table, transfer times and headways…');
const fareRes = await fetchWithRetry(SOURCES.metroFaresCsv);
// The CSV is Big5-encoded (the response says charset=BIG-5).
const fareCsv = new TextDecoder('big5').decode(await fareRes.arrayBuffer());

type Rows<T> = { result: { results: T[] } };
const getRows = async <T>(url: string) => ((await (await fetchWithRetry(url)).json()) as Rows<T>).result.results;
const transferRows = await getRows<MetroSources['transferRows'][number]>(SOURCES.metroTransferWalk);
const headwayRows = await getRows<MetroSources['headwayRows'][number]>(SOURCES.metroHeadways);

const { data, warnings } = transformMetro(
  { osm, fareCsv, transferRows, headwayRows },
  METRO_LINES,
  new Date().toISOString(),
);
for (const w of warnings) console.warn(`  ! ${w}`);
await writeJson(out, data);
console.log(
  `Wrote ${out}: ${data.stations.length} stations, ${data.lines.length} lines, ${data.patterns.length} patterns.`,
);
