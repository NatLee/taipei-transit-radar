// Builds public/data/bus.json from the Taipei e-bus feed. Runs at deploy time (the file is not
// committed) so the site always ships the current routes. Usage: npm run data:bus

import { fileURLToPath } from 'node:url';
import { SOURCES } from '../src/config.ts';
import { transformBus, type RawBusRoute, type RawBusStop, type RawFeed } from '../src/data/transformBus.ts';
import { fetchGzipJson, writeJson } from './lib.ts';

/** A healthy feed has ~400 routes and ~5,000 stops; far less means the upstream file is broken. */
const MIN_ROUTES = 100;
const MIN_STOPS = 1000;

const out = fileURLToPath(new URL('../public/data/bus.json', import.meta.url));

console.log('Fetching Taipei e-bus routes and stops…');
const [routes, stops] = await Promise.all([
  fetchGzipJson<RawFeed<RawBusRoute>>(SOURCES.busRoutes),
  fetchGzipJson<RawFeed<RawBusStop>>(SOURCES.busStops),
]);
const data = transformBus(routes, stops, new Date().toISOString());
if (data.routes.length < MIN_ROUTES || data.stops.length < MIN_STOPS) {
  throw new Error(
    `Suspiciously small bus network (${data.routes.length} routes, ${data.stops.length} stops); not writing it.`,
  );
}
await writeJson(out, data);
console.log(
  `Wrote ${out}: ${data.routes.length} routes, ${data.stops.length} stops (feed updated ${data.sourceUpdatedAt}).`,
);
