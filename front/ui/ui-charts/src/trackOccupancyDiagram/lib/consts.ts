import { FONT_MONO, FONT_SANS } from '../../common/consts';

export const TRACK_HEIGHT_CONTAINER = 100;
export const CANVAS_PADDING = 10;
export const OCCUPANCY_ZONE_Y_START = TRACK_HEIGHT_CONTAINER / 2 - 1.5;
export const OCCUPANCY_ZONE_HEIGHT = 3;
/** White line drawn on the edges of an occupancy bar, to separate it from the ones next to it. */
export const OCCUPANCY_SEPARATOR_WIDTH = 0.5;
export const MINUTES_TEXT_OFFSET = 8.5;
export const STATION_TEXT_OFFSET = 5;

export const TICKS_PATTERN = {
  MINUTE: [2, 9, 2],
  FIVE_MINUTES: [6, 9, 6],
  QUARTER_HOUR: [2, 2, 6, 9, 6, 2, 2],
  HALF_HOUR: [2, 2, 2, 2, 6, 9, 6, 2, 2, 2, 2],
  HOUR: [16, 9, 16],
};

export const TICKS_PRIORITIES = [
  [0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1],
  [0, 0, 0, 0, 0, 3, 1, 1, 1, 1, 1],
  [0, 0, 0, 3, 2, 1, 1, 1, 1, 1, 1],
  [0, 0, 0, 3, 2, 1, 1, 1, 1, 1, 1],
  [0, 0, 3, 2, 1, 1, 1, 1, 1, 1, 1],
  [0, 0, 3, 2, 1, 1, 1, 1, 1, 1, 1],
  [0, 0, 3, 2, 1, 1, 1, 1, 1, 1, 1],
  [0, 0, 3, 2, 1, 1, 1, 1, 1, 1, 1],
];

// ========== FONT CONSTANTS ==========

export const FONT_MONO_REGULAR = `400 10px ${FONT_MONO}`;
export const FONT_SANS_REGULAR = `400 12px ${FONT_SANS}`;

export const FONT_MONO_BOLD = `600 12px ${FONT_MONO}`;
