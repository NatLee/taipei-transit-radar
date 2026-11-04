// Taipei Metro lines as shown to riders. Colours are the official line colours.
// `match` picks the OpenStreetMap route relations of each line; `headwayRoute` is the
// matching `routeid` in data.taipei's headway dataset (the "-1" row is the full-length service).

import type { MetroLineConfig } from '../src/data/transformMetro.ts';

/**
 * The headway dataset has no row we can tie to the Circular line or to the two branch lines
 * with certainty, so they use this typical gap instead. The app labels those waits as estimates.
 */
const UNKNOWN_HEADWAY_MIN = 10;

export const METRO_LINES: MetroLineConfig[] = [
  { code: 'BR', name: '文湖線', nameEn: 'Wenhu Line', color: '#c48c31', match: { ref: 'BR' }, headwayRoute: 'BR-1', fallbackHeadwayMin: UNKNOWN_HEADWAY_MIN },
  { code: 'R', name: '淡水信義線', nameEn: 'Tamsui-Xinyi Line', color: '#e3002c', match: { ref: 'R' }, headwayRoute: 'R-1', fallbackHeadwayMin: UNKNOWN_HEADWAY_MIN },
  { code: 'R22A', name: '新北投支線', nameEn: 'Xinbeitou Branch', color: '#fd92a3', match: { name: /新北投支線/ }, headwayRoute: null, fallbackHeadwayMin: UNKNOWN_HEADWAY_MIN },
  { code: 'G', name: '松山新店線', nameEn: 'Songshan-Xindian Line', color: '#008659', match: { ref: 'G', notName: /小碧潭/ }, headwayRoute: 'G-1', fallbackHeadwayMin: UNKNOWN_HEADWAY_MIN },
  { code: 'G03A', name: '小碧潭支線', nameEn: 'Xiaobitan Branch', color: '#cfdb00', match: { name: /小碧潭支線/ }, headwayRoute: null, fallbackHeadwayMin: UNKNOWN_HEADWAY_MIN },
  { code: 'O', name: '中和新蘆線', nameEn: 'Zhonghe-Xinlu Line', color: '#f8b61c', match: { ref: 'O' }, headwayRoute: 'O-1', fallbackHeadwayMin: UNKNOWN_HEADWAY_MIN },
  { code: 'BL', name: '板南線', nameEn: 'Bannan Line', color: '#0070bd', match: { ref: 'BL' }, headwayRoute: 'BL-1', fallbackHeadwayMin: UNKNOWN_HEADWAY_MIN },
  { code: 'Y', name: '環狀線', nameEn: 'Circular Line', color: '#fedb00', match: { ref: 'Y' }, headwayRoute: null, fallbackHeadwayMin: UNKNOWN_HEADWAY_MIN },
];
