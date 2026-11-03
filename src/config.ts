// Every tunable number and every external URL lives here, with where it comes from.
// Logic modules take these values as inputs instead of hard-coding them.

export const PROJECT = {
  repoUrl: 'https://github.com/NatLee/taipei-transit-radar',
  /** The 2016 team deck, kept as Markdown in the repo. */
  deckPath: 'blob/main/docs/2016-hackathon.md',
  /** GitHub account of the 2016 teammate who wrote most of the original code. */
  teammate: 'impaulapple',
} as const;

/** Open data feeds. All of them are free, need no key and allow cross-origin reads. */
export const SOURCES = {
  /** Taipei e-bus feed (臺北市公車動態資訊). Gzipped JSON, `Access-Control-Allow-Origin: *`. */
  busRoutes: 'https://tcgbusfs.blob.core.windows.net/blobbus/GetRoute.gz',
  busStops: 'https://tcgbusfs.blob.core.windows.net/blobbus/GetStop.gz',
  busEstimates: 'https://tcgbusfs.blob.core.windows.net/blobbus/GetEstimateTime.gz',
  /** YouBike 2.0 live dock status for Taipei City. Plain JSON, CORS open. */
  youbike: 'https://tcgbusfs.blob.core.windows.net/dotapp/youbike/v2/youbike_immediate.json',
  /** data.taipei datasets used at build time only (their CORS policy blocks browsers). */
  metroFaresCsv:
    'https://data.taipei/api/dataset/4acb4911-0360-4063-808d-fcee629508b3/resource/893c2f2a-dcfd-407b-b871-394a14105532/download',
  metroTransferWalk:
    'https://data.taipei/api/v1/dataset/14fd1af0-dc2b-4174-87d4-fcb9de783496?scope=resourceAquire&limit=1000',
  metroHeadways:
    'https://data.taipei/api/v1/dataset/650a2f12-dc02-4733-89d3-46de2fba6a8e?scope=resourceAquire&limit=1000',
  /** Public Overpass instances, tried in order (the first one often answers 502 under load). */
  overpass: ['https://overpass-api.de/api/interpreter', 'https://overpass.private.coffee/api/interpreter'],
} as const;

export const MAP = {
  /** OpenFreeMap: free vector tiles, no key, no request cap; attribution comes with the TileJSON. */
  styleUrl: 'https://tiles.openfreemap.org/styles/dark',
  /** Same host's font glyphs; used for our own labels if the style itself fails to load. */
  glyphsUrl: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
  /** Taipei Main Station; the view the original 2016 page fell back to was nearby. */
  center: { lat: 25.0478, lon: 121.517 },
  zoom: 12,
  /** Greater Taipei; the map won't pan far outside it. */
  bounds: [
    [121.2, 24.85],
    [121.85, 25.3],
  ] as [[number, number], [number, number]],
} as const;

export const TRAVEL = {
  /** 4.5 km/h, a relaxed city pace. */
  walkMPerMin: 75,
  /** Streets are not straight lines: multiply crow-fly distance by this for walking and cycling. */
  walkDetour: 1.3,
  /** Taipei City bus average operating speed is roughly 15–18 km/h; take the low end for peak traffic. */
  busKmh: 15,
  busDetour: 1.2,
  /**
   * Taipei Metro schedule speed including dwell, about 33 km/h (e.g. Tamsui → Taipei Main Station,
   * 20.9 km of track in the fare table, takes about 38 min). Used because the open data has no free per-segment run times.
   */
  metroKmh: 33,
  /** Gate-to-platform time when a station has no official transfer time. */
  metroAccessMin: 3,
  /** YouBike 2.0 commuting pace, 12 km/h, plus time to rent and return. */
  bikeKmh: 12,
  bikeDockMin: 2,
  /** Search radius around origin/destination for stops and stations. */
  accessRadiusM: 900,
  /** Walking transfers between stops (bus ↔ bus, bus ↔ MRT). */
  transferRadiusM: 300,
  /** Penalty added per boarding so the planner doesn't trade 1 minute for an extra transfer. */
  boardPenaltyMin: 4,
  /** Walking minutes count a bit more than riding minutes when choosing a route. */
  walkReluctance: 1.3,
  /** Hours treated as peak for bus headways (the feed gives peak/off-peak ranges but no hours). */
  busPeakHours: [
    [7 * 60, 9 * 60],
    [17 * 60, 19 * 60 + 30],
  ] as [number, number][],
  /** Bus headway when the feed leaves it blank. */
  busFallbackHeadwayMin: 15,
} as const;

export const FARES = {
  /**
   * Taipei/New Taipei joint bus fare per segment, adult, e-ticket (臺北市聯營公車一段票全票 15 元).
   */
  busPerSegment: 15,
  /**
   * YouBike 2.0 in Taipei City for registered members: first 30 minutes free (city subsidy since
   * 2024-02-28), then NT$10 per 30 minutes up to 4 hours.
   * Source: https://www.youbike.com.tw/region/taipei/news/service/65dc48e2b507cedede07c6e2/
   */
  youbikeFreeMin: 30,
  youbikeBlockMin: 30,
  youbikePerBlock: 10,
} as const;

/** Calories use MET × body weight × hours. The 2016 page counted calories for a 60 kg person. */
export const BODY = {
  weightKg: 60,
  /** Compendium of Physical Activities: walking ~4.5 km/h ≈ 3.5 MET; leisure cycling ~12 km/h ≈ 6.8 MET. */
  walkMet: 3.5,
  bikeMet: 6.8,
} as const;

export const LIVE = {
  /** The bus feed refreshes every minute; don't refetch more often than this. */
  busTtlMs: 45_000,
  youbikeTtlMs: 60_000,
  nearbyStopRadiusM: 400,
  nearbyStationRadiusM: 900,
  nearbyDockRadiusM: 500,
  /** Ignore docks that are farther than this from the origin/destination for the YouBike option. */
  youbikeDockRadiusM: 700,
} as const;
