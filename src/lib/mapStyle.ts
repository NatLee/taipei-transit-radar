// Re-tints the OpenFreeMap "dark" vector style into the neon-on-black palette. Works on the
// public style JSON (layer types and ids), not on MapLibre internals, so a style update upstream
// at worst leaves a layer in its original colour.

import type { StyleSpecification, LayerSpecification } from 'maplibre-gl';

export const PALETTE = {
  void: '#04060b',
  water: '#06192a',
  waterLine: '#0b3048',
  park: '#06140f',
  building: '#0a1322',
  buildingLine: '#122a42',
  roadMajor: '#1c4b66',
  roadMinor: '#11283b',
  rail: '#1a3149',
  boundary: '#2a4a63',
  label: '#4f7f93',
  labelMajor: '#bdeaf7',
} as const;

type Paint = Record<string, unknown>;

function roadColor(id: string): string {
  return /motorway|trunk|primary|major|highway/.test(id) ? PALETTE.roadMajor : PALETTE.roadMinor;
}

/** Chinese street and place names first: in Taiwan the OSM `name` tag is the local name. */
const LOCAL_NAME = ['coalesce', ['get', 'name'], ['get', 'name_en'], ['get', 'name:latin']];

function retint(layer: LayerSpecification): LayerSpecification {
  const id = layer.id.toLowerCase();
  const paint: Paint = { ...(('paint' in layer && layer.paint) || {}) };
  const layout: Paint = { ...(('layout' in layer && layer.layout) || {}) };
  switch (layer.type) {
    case 'background':
      paint['background-color'] = PALETTE.void;
      break;
    case 'fill':
      // Textures (e.g. wood) don't fit the look, and the upstream dark style ships without them.
      delete paint['fill-pattern'];
      if (/water|ocean|lake|river/.test(id)) paint['fill-color'] = PALETTE.water;
      else if (/building/.test(id)) {
        paint['fill-color'] = PALETTE.building;
        paint['fill-outline-color'] = PALETTE.buildingLine;
      } else if (/park|landcover|landuse|wood|grass/.test(id)) paint['fill-color'] = PALETTE.park;
      break;
    case 'line':
      if (/water|river|canal|stream/.test(id)) paint['line-color'] = PALETTE.waterLine;
      else if (/rail|transit/.test(id)) paint['line-color'] = PALETTE.rail;
      else if (/boundary|admin/.test(id)) paint['line-color'] = PALETTE.boundary;
      else if (/road|highway|street|bridge|tunnel|path|motorway|trunk|primary|secondary|tertiary|minor|service/.test(id))
        paint['line-color'] = roadColor(id);
      break;
    case 'symbol':
      if ('text-field' in layout) {
        if (JSON.stringify(layout['text-field']).includes('name')) layout['text-field'] = LOCAL_NAME;
        paint['text-color'] = /place|city|town|country/.test(id) ? PALETTE.labelMajor : PALETTE.label;
        paint['text-halo-color'] = PALETTE.void;
        paint['text-halo-width'] = 1.2;
      }
      break;
  }
  return { ...layer, paint, layout } as LayerSpecification;
}

export function cyberizeStyle(style: StyleSpecification): StyleSpecification {
  return { ...style, layers: style.layers.map(retint) };
}
