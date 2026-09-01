import type { RGBColor } from '../types';

// COLORS DEFINITIONS:
export const BLACK_100 = 'rgb(0, 0, 0)';
export const BLACK_ALPHA_10 = 'rgba(0, 0, 0, 0.1)';
export const BLACK_ALPHA_25 = 'rgba(0, 0, 0, 0.25)';

export const GREY_90 = 'rgb(31, 27, 23)';
export const GREY_50 = 'rgb(121, 118, 113)';
export const GREY_30 = 'rgb(182, 178, 175)';

export const RED_100 = 'rgb(221, 34, 34)';

export const WHITE_100 = 'rgb(255, 255, 255)';

/**
 * This function returns a unique hex color corresponding to the given index. The colors are
 * generated as #000001, #000002 ... #0000ff, #000100 etc.
 * These colors aim at representing the given indices on the picking layer.
 */
export function indexToColor(index: number): RGBColor {
  if (index > 0xFFFFFF) {
    throw new Error('Index too large');
  }

  return [
    (index >> 0) & 0xFF,
    (index >> 8) & 0xFF,
    (index >> 16) & 0xFF,
  ];
}

/**
 * This function returns the index corresponding to the given color.
 */
export function colorToIndex(color: RGBColor): number {
  return (color[0] << 0) | (color[1] << 8) | (color[2] << 16);
}
