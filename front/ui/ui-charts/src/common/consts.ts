import { LayerEntry } from "./types";

export const LAYERS = ['background', 'graduations', 'paths', 'overlay', 'captions'] as const;
export const PICKING_LAYERS = ['paths', 'overlay'] as const;

export const RENDERING = 'rendering';
export const PICKING = 'picking';

export const allLayers: LayerEntry[] = [
  ...LAYERS.map((layer) => ({ type: RENDERING, layer }) as const),
  ...PICKING_LAYERS.map((layer) => ({ type: PICKING, layer }) as const),
];

// ========== METRIC CONSTANTS ==========

export const SECOND = 1000;
export const MINUTE = 60 * SECOND;
export const HOUR = 60 * MINUTE;

export const KILOMETER = 1000000;

// ========== STYLE CONSTANTS ==========

export const FONT_MONO = 'IBM Plex Mono';
export const FONT_SANS = 'IBM Plex Sans';
