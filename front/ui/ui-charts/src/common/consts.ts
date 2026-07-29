export const PICKING_LAYERS = ['paths', 'overlay'] as const;
export const LAYERS = ['background', 'graduations', 'paths', 'overlay', 'captions'] as const;

// ========== METRIC CONSTANTS ==========

export const SECOND = 1000;
export const MINUTE = 60 * SECOND;
export const HOUR = 60 * MINUTE;

export const KILOMETER = 1000000;

// ========== CHRONOGRAM CONSTANTS ==========

export const CHRONOGRAM_HEADER_HEIGHT = 33;
export const CHRONOGRAM_BOTTOM_PADDING = 40;
export const INITIAL_CHRONOGRAM_HEIGHT = 600;
export const LEVEL_CROSSING_ITEM_HEIGHT = 48;
export const CHRONOGRAM_SLIDER_WIDTH = 122;

// ========== CANVAS CONSTANTS ==========

export enum CANVASMODE {
  PICKING = 'picking',
  RENDERING = 'rendering'
}


// ========== STYLE CONSTANTS ==========


export const FONT_SIZE = 10;
export const FONT = 'IBM Plex Mono'

