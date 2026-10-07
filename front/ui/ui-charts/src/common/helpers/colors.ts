import type { RGBColor } from '../types';

// COLORS DEFINITIONS:
export const BLACK_ALPHA_100 = 'rgb(0, 0, 0)';
export const BLACK_ALPHA_70 = 'rgb(0 0 0 / 0.70)';
export const BLACK_ALPHA_55 = 'rgb(0 0 0 / 0.55)';
export const BLACK_ALPHA_50 = 'rgb(0 0 0 / 0.5)';
export const BLACK_ALPHA_25 = 'rgb(0 0 0 / 0.25)';
export const BLACK_ALPHA_10 = 'rgb(0 0 0 / 0.1)';

export const WHITE_ALPHA_100 = 'rgb(255, 255, 255)';
export const WHITE_ALPHA_50 = 'rgb(255 255 255 / 0.50)';

export const PRIMARY_80 = 'rgb(31, 15, 150)';
export const PRIMARY_50 = 'rgb(37, 106, 250)';
export const PRIMARY_40 = 'rgb(60, 138, 255)';
export const PRIMARY_30 = 'rgb(114, 168, 247)';
export const PRIMARY_5 = 'rgb(227, 237, 252)';

export const AMBIENT_B_15 = 'rgb(242, 240, 228)';
export const AMBIENT_B_5 = 'rgb(250, 249, 245)';

export const ERROR_60 = 'rgb(217, 28, 28)';

export const WARNING_60 = 'rgb(125, 82, 30)';
export const WARNING_30 = 'rgb(234, 167, 34)';

export const GREY_90 = 'rgb(31, 27, 23)';
export const GREY_80 = 'rgb(49, 46, 43)';
export const GREY_60 = 'rgb(92, 89, 85)';
export const GREY_50 = 'rgb(121, 118, 113)';
export const GREY_30 = 'rgb(182, 178, 175)';
export const GREY_20 = 'rgb(211, 209, 207)';

export const CYAN_300 = 'rgb(105, 255, 254)';

export const RED_100 = 'rgb(221, 34, 34)';

export const SKY_700 = 'rgb(33, 112, 185)';

export const BROWN_50 = 'rgb(138, 113, 75)';

/**
 * This function returns a unique hex color corresponding to the given index. The colors are
 * generated as #000001, #000002 ... #0000ff, #000100 etc.
 * These colors aim at representing the given indices on the picking layer.
 */
export function indexToColor(index: number): RGBColor {
  if (index > 0xffffff) {
    throw new Error('Index too large');
  }

  return [(index >> 0) & 0xff, (index >> 8) & 0xff, (index >> 16) & 0xff];
}

/**
 * This function returns the index corresponding to the given color.
 */
export function colorToIndex(color: RGBColor): number {
  return (color[0] << 0) | (color[1] << 8) | (color[2] << 16);
}
