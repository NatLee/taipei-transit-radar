import type { Feature, FeatureCollection, Point as GeoPoint } from 'geojson';
import * as maplibregl from 'maplibre-gl';
import type { GeoJSONSource, LngLatBoundsLike, MapMouseEvent, StyleSpecification } from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import { useEffect, useRef, useState } from 'react';
import { MAP } from '../config.ts';
import type { BusData, MetroData } from '../data/schema.ts';
import type { Point } from '../lib/geo.ts';
import { cyberizeStyle } from '../lib/mapStyle.ts';
import { stationLabel, type ChosenPlace } from '../lib/places.ts';
import type { Dock, TripOption } from '../lib/plan.ts';
import type { PlaceRef } from '../lib/share.ts';

export interface MapPick extends Point {
  name?: string;
  ref?: PlaceRef;
}

interface Props {
  metro: MetroData | null;
  bus: BusData | null;
  docks: Dock[] | null;
  origin: ChosenPlace | null;
  destination: ChosenPlace | null;
  trip: TripOption | null;
  pick: Point | null;
  reducedMotion: boolean;
  /** Extra room on each side so fitted routes are not hidden behind the panel. */
  padding: { top: number; right: number; bottom: number; left: number };
  onPick: (p: MapPick) => void;
}

const BUS_COLOR = '#ff4fdc';
const WALK_COLOR = '#d8f4ff';
const BIKE_COLOR = '#b8ff3c';
const LABEL_FONT = ['Noto Sans Regular'];
/** Half the radar marker's size (.radar in index.css is 132px). */
const MARKER_ROOM = 66;
const EMPTY: FeatureCollection = { type: 'FeatureCollection', features: [] };

const ll = (p: Point): [number, number] => [p.lon, p.lat];

function metroLinesGeo(m: MetroData): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: m.lines.map((l) => ({
      type: 'Feature',
      properties: { color: l.color, code: l.code },
      geometry: { type: 'MultiLineString', coordinates: l.shape },
    })),
  };
}

function stationsGeo(m: MetroData): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: m.stations.map((s) => ({
      type: 'Feature',
      properties: { id: s.id, name: s.name, transfer: s.lines.length > 1 },
      geometry: { type: 'Point', coordinates: ll(s) },
    })),
  };
}

function busStopsGeo(b: BusData | null): FeatureCollection {
  if (!b) return EMPTY;
  return {
    type: 'FeatureCollection',
    features: b.stops.map((s) => ({
      type: 'Feature',
      properties: { id: s.id, name: s.name },
      geometry: { type: 'Point', coordinates: ll(s) },
    })),
  };
}

function docksGeo(d: Dock[] | null): FeatureCollection {
  if (!d) return EMPTY;
  return {
    type: 'FeatureCollection',
    features: d.map((x) => ({
      type: 'Feature',
      properties: { name: x.name, bikes: x.bikes, slots: x.slots },
      geometry: { type: 'Point', coordinates: ll(x) },
    })),
  };
}

function tripGeo(t: TripOption | null): FeatureCollection {
  if (!t) return EMPTY;
  const features: Feature[] = [];
  for (const s of t.steps) {
    if (s.kind === 'walk') {
      features.push({
        type: 'Feature',
        properties: { kind: 'walk', color: WALK_COLOR },
        geometry: { type: 'LineString', coordinates: [ll(s.from), ll(s.to)] },
      });
    } else if (s.kind === 'bike') {
      features.push({
        type: 'Feature',
        properties: { kind: 'bike', color: BIKE_COLOR },
        geometry: { type: 'LineString', coordinates: [ll(s.from), ll(s.to)] },
      });
    } else {
      features.push({
        type: 'Feature',
        properties: { kind: 'ride', color: s.mode === 'metro' ? s.color : BUS_COLOR },
        geometry: { type: 'LineString', coordinates: s.path.map(ll) },
      });
      for (const end of [s.from, s.to])
        features.push({
          type: 'Feature',
          properties: { kind: 'stop', name: end.name, color: s.mode === 'metro' ? s.color : BUS_COLOR },
          geometry: { type: 'Point', coordinates: ll(end) },
        });
    }
  }
  return { type: 'FeatureCollection', features };
}

function addLayers(map: maplibregl.Map) {
  map.addSource('metro-lines', { type: 'geojson', data: EMPTY });
  map.addSource('stations', { type: 'geojson', data: EMPTY });
  map.addSource('bus-stops', { type: 'geojson', data: EMPTY });
  map.addSource('docks', { type: 'geojson', data: EMPTY });
  map.addSource('trip', { type: 'geojson', data: EMPTY });
  const zoomed = (z0: number, v0: number, z1: number, v1: number) =>
    ['interpolate', ['linear'], ['zoom'], z0, v0, z1, v1] as maplibregl.ExpressionSpecification;

  map.addLayer({
    id: 'metro-glow',
    type: 'line',
    source: 'metro-lines',
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': ['get', 'color'], 'line-width': zoomed(10, 6, 15, 16), 'line-blur': zoomed(10, 4, 15, 10), 'line-opacity': 0.45 },
  });
  map.addLayer({
    id: 'metro-core',
    type: 'line',
    source: 'metro-lines',
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': ['get', 'color'], 'line-width': zoomed(10, 1.4, 15, 3.6), 'line-opacity': 0.95 },
  });
  map.addLayer({
    id: 'bus-stops',
    type: 'circle',
    source: 'bus-stops',
    minzoom: 14.5,
    paint: {
      'circle-radius': zoomed(14.5, 2, 18, 5),
      'circle-color': '#04060b',
      'circle-stroke-color': BUS_COLOR,
      'circle-stroke-width': 1.2,
      'circle-stroke-opacity': 0.8,
    },
  });
  map.addLayer({
    id: 'docks',
    type: 'circle',
    source: 'docks',
    minzoom: 15,
    paint: {
      'circle-radius': zoomed(15, 2.5, 18, 6),
      'circle-color': ['case', ['>', ['get', 'bikes'], 0], BIKE_COLOR, '#3b4a52'],
      'circle-opacity': 0.85,
    },
  });
  map.addLayer({
    id: 'stations',
    type: 'circle',
    source: 'stations',
    paint: {
      // Transfer stations are drawn larger; MapLibre allows one zoom curve per expression.
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, ['case', ['get', 'transfer'], 3.5, 2.2], 15, ['case', ['get', 'transfer'], 7, 5]],
      'circle-color': '#04060b',
      'circle-stroke-color': ['case', ['get', 'transfer'], '#ffffff', '#2ef2ff'],
      'circle-stroke-width': zoomed(10, 1.2, 15, 2.2),
    },
  });
  map.addLayer({
    id: 'station-labels',
    type: 'symbol',
    source: 'stations',
    minzoom: 12,
    layout: {
      'text-field': ['get', 'name'],
      'text-font': LABEL_FONT,
      'text-size': zoomed(12, 11, 16, 14),
      'text-offset': [0, 1.1],
      'text-anchor': 'top',
      'text-optional': true,
    },
    paint: { 'text-color': '#bff7ff', 'text-halo-color': '#04060b', 'text-halo-width': 1.4 },
  });
  map.addLayer({
    id: 'trip-glow',
    type: 'line',
    source: 'trip',
    filter: ['!=', ['get', 'kind'], 'walk'],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': ['get', 'color'], 'line-width': 18, 'line-blur': 10, 'line-opacity': 0.55 },
  });
  map.addLayer({
    id: 'trip-core',
    type: 'line',
    source: 'trip',
    filter: ['!=', ['get', 'kind'], 'walk'],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': ['get', 'color'], 'line-width': 5 },
  });
  map.addLayer({
    id: 'trip-walk',
    type: 'line',
    source: 'trip',
    filter: ['==', ['get', 'kind'], 'walk'],
    layout: { 'line-cap': 'round' },
    paint: { 'line-color': WALK_COLOR, 'line-width': 2.5, 'line-dasharray': [0.5, 2] },
  });
  map.addLayer({
    id: 'trip-stops',
    type: 'circle',
    source: 'trip',
    filter: ['==', ['get', 'kind'], 'stop'],
    paint: { 'circle-radius': 6, 'circle-color': '#04060b', 'circle-stroke-color': ['get', 'color'], 'circle-stroke-width': 3 },
  });
}

const INTERACTIVE = ['stations', 'bus-stops', 'docks'];

// MapLibre 6 looks for its worker next to its own module file, which a bundler moves.
// Point it at the copy Vite emits instead (public API, see maplibre-gl's setWorkerUrl).
maplibregl.setWorkerUrl(workerUrl);

export default function MapView(props: Props) {
  const { metro, bus, docks, origin, destination, trip, pick, reducedMotion, padding, onPick } = props;
  const box = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [ready, setReady] = useState(false);
  const [styleError, setStyleError] = useState<string | null>(null);
  const onPickRef = useRef(onPick);
  useEffect(() => {
    onPickRef.current = onPick;
  }, [onPick]);

  useEffect(() => {
    let disposed = false;
    const fallback: StyleSpecification = { version: 8, sources: {}, layers: [{ id: 'bg', type: 'background', paint: { 'background-color': '#04060b' } }] };
    fetch(MAP.styleUrl)
      .then((r) => (r.ok ? (r.json() as Promise<StyleSpecification>) : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then(cyberizeStyle)
      .catch((e: unknown) => {
        setStyleError(`底圖載入失敗（${String(e)}），只顯示路線。`);
        return { ...fallback, glyphs: MAP.glyphsUrl };
      })
      .then((style) => {
        if (disposed || !box.current) return;
        const map = new maplibregl.Map({
          container: box.current,
          style,
          center: ll(MAP.center),
          zoom: MAP.zoom,
          maxBounds: MAP.bounds,
          attributionControl: {
            compact: true,
            customAttribution: '捷運路線 © OpenStreetMap contributors · 公車／YouBike／票價：臺北市政府開放資料',
          },
        });
        map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');
        map.on('load', () => {
          addLayers(map);
          setReady(true);
        });
        map.on('click', (e: MapMouseEvent) => {
          const hit = map.queryRenderedFeatures(e.point, { layers: INTERACTIVE.filter((l) => map.getLayer(l)) })[0];
          const coords = (hit?.geometry as GeoPoint | undefined)?.coordinates;
          if (hit && coords) {
            const [lon, lat] = coords as [number, number];
            const p = hit.properties as Record<string, string | number>;
            if (hit.layer.id === 'stations')
              return onPickRef.current({ lat, lon, name: stationLabel(String(p.name)), ref: { kind: 'station', id: String(p.id) } });
            if (hit.layer.id === 'bus-stops')
              return onPickRef.current({ lat, lon, name: String(p.name), ref: { kind: 'busStop', id: Number(p.id) } });
            return onPickRef.current({ lat, lon, name: `YouBike ${p.name}`, ref: { kind: 'point', lat, lon, label: String(p.name) } });
          }
          onPickRef.current({ lat: e.lngLat.lat, lon: e.lngLat.lng });
        });
        for (const id of INTERACTIVE) {
          map.on('mouseenter', id, () => (map.getCanvas().style.cursor = 'pointer'));
          map.on('mouseleave', id, () => (map.getCanvas().style.cursor = ''));
        }
        mapRef.current = map;
      });
    return () => {
      disposed = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  const setData = (id: string, data: FeatureCollection) =>
    (mapRef.current?.getSource(id) as GeoJSONSource | undefined)?.setData(data);

  useEffect(() => {
    if (!ready || !metro) return;
    setData('metro-lines', metroLinesGeo(metro));
    setData('stations', stationsGeo(metro));
  }, [ready, metro]);
  useEffect(() => {
    if (ready) setData('bus-stops', busStopsGeo(bus));
  }, [ready, bus]);
  useEffect(() => {
    if (ready) setData('docks', docksGeo(docks));
  }, [ready, docks]);
  useEffect(() => {
    if (!ready) return;
    setData('trip', tripGeo(trip));
    // With a trip on screen, fade the rest of the network so the route stands out.
    const map = mapRef.current!;
    map.setPaintProperty('metro-core', 'line-opacity', trip ? 0.35 : 0.95);
    map.setPaintProperty('metro-glow', 'line-opacity', trip ? 0.12 : 0.45);
  }, [ready, trip]);

  // Markers: radar at the origin, target at the destination, crosshair at a tapped point.
  useMarker(mapRef, ready, origin, 'radar');
  useMarker(mapRef, ready, destination, 'target');
  useMarker(mapRef, ready, pick, 'crosshair');

  // Frame the selected trip, or the chosen place(s).
  const duration = reducedMotion ? 0 : 900;
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const pts: Point[] = trip
      ? trip.steps.flatMap((s) => (s.kind === 'ride' ? s.path : [s.from, s.to]))
      : ([origin, destination].filter(Boolean) as Point[]);
    if (!pts.length) return;
    if (pts.length === 1) {
      map.easeTo({ center: ll(pts[0]!), zoom: Math.max(map.getZoom(), 14), duration, padding });
      return;
    }
    const lons = pts.map((p) => p.lon);
    const lats = pts.map((p) => p.lat);
    const bounds: LngLatBoundsLike = [
      [Math.min(...lons), Math.min(...lats)],
      [Math.max(...lons), Math.max(...lats)],
    ];
    // MARKER_ROOM keeps the radar marker around the origin inside the view.
    const pad = { top: padding.top + MARKER_ROOM, right: padding.right + MARKER_ROOM, bottom: padding.bottom + MARKER_ROOM, left: padding.left + MARKER_ROOM };
    map.fitBounds(bounds, { padding: pad, duration, maxZoom: 16 });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- padding is a fresh object each render
  }, [ready, trip, origin, destination, duration]);

  return (
    <div className="absolute inset-0">
      <div ref={box} className="h-full w-full" role="region" aria-label="地圖：點一下可以選起點或終點" />
      {styleError ? (
        <p className="absolute top-3 left-1/2 -translate-x-1/2 rounded bg-amber/90 px-3 py-1 text-sm text-void">{styleError}</p>
      ) : null}
    </div>
  );
}

function useMarker(
  mapRef: React.RefObject<maplibregl.Map | null>,
  ready: boolean,
  at: Point | null,
  className: string,
) {
  const marker = useRef<maplibregl.Marker | null>(null);
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    if (!at) {
      marker.current?.remove();
      marker.current = null;
      return;
    }
    if (!marker.current) {
      const el = document.createElement('div');
      el.className = className;
      marker.current = new maplibregl.Marker({ element: el }).setLngLat(ll(at)).addTo(map);
    } else marker.current.setLngLat(ll(at));
  }, [mapRef, ready, at, className]);
  useEffect(
    () => () => {
      marker.current?.remove();
    },
    [],
  );
}
