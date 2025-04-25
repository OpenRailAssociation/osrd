export const TRACK_HEIGHT_CONTAINER = 100;
export const CANVAS_PADDING = 10;
export const OCCUPANCY_ZONE_Y_START = TRACK_HEIGHT_CONTAINER / 2 - 1.5;
export const OCCUPANCY_ZONE_HEIGHT = 3;
export const MINUTES_TEXT_OFFSET = 8.5;
export const STATION_TEXT_OFFSET = 5;

export const FONTS = {
  SANS: '400 12px IBM Plex Sans',
  MONO: '400 10px IBM Plex Mono',
};

export const COLORS = {
  GREY_20: 'rgb(211, 209, 207)',
  GREY_50: 'rgb(121, 118, 113)',
  GREY_60: 'rgb(92, 89, 85)',
  GREY_80: 'rgb(49, 46, 43)',
  MANCHETTE_BACKGROUND: '#f2f0e4',
  HOUR_BACKGROUND_1: '#faf9f5',
  HOUR_BACKGROUND_2: '#f2f0e4',
  RAIL_TICK: 'rgb(33, 112, 185)',
  REMAINING_TRAINS_BACKGROUND: 'rgba(0, 0, 0, 0.7)',
  SELECTION_20: 'rgb(255, 242, 179)',
  WHITE_50: 'rgba(255, 255, 255, 0.5)',
  WHITE_100: 'rgb(255, 255, 255)',
};

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
