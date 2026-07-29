import chroma from 'chroma-js';

import type { RGBAColor } from '../types';

const COLORS_TO_INDICES: Record<string, number> = {};
const INDICES_TO_COLORS: Record<number, string> = {};

// COLORS DEFINITIONS:
export const BLACK_100 = 'rgb(0, 0, 0)';
export const BLACK_70 = 'rgb(0, 0, 0, 0.70)'
export const BLACK_55 = 'rgba(0, 0, 0, 0.55)';
export const BLACK_25 = 'rgba(0, 0, 0, 0.25)';
export const BLACK_20 = 'rgba(0, 0, 0, 0.20)';
export const BLACK_10 = 'rgba(0, 0, 0, 0.10)';
export const BLACK_5 = 'rgb(0, 0, 0, 0.5)';

export const GREY_90 = 'rgb(31, 27, 23)';
export const GREY_80 = 'rgb(49, 46, 43)';
export const GREY_60 = 'rgb(92, 89, 85)';
export const GREY_50 = 'rgb(121, 118, 113)';
export const GREY_30 = 'rgb(182, 178, 175)';
export const GREY_20 = 'rgb(211, 209, 207)';
export const GREY_10 = 'rgb((237, 237, 237)';

export const PRIMARY_80 = 'rgb(31, 15, 150)';
export const PRIMARY_50 = 'rgb(37, 106, 250)';
export const PRIMARY_30 = 'rgb(114, 168, 247)';
export const PRIMARY_5 = 'rgb(227, 237, 252)';

export const RED_100 = 'rgb(221, 34, 34)';

export const CYAN_400 = 'rgb(3, 222, 255)';

export const BLUE_700 = 'rgb(0, 87, 218)';

export const WHITE_100 = 'rgb(255, 255, 255)';
export const WHITE_50 = 'rgba(255, 255, 255, 0.50)';
export const WHITE_75 = 'rgba(255, 255, 255, 0.75)';

export const YELLOW_400 = 'rgb(255, 192, 3)';

export const SKY_900 = 'rgb(7, 69, 128)';
export const SKY_700 = 'rgb(33, 112, 185)';
export const STONE_50 = 'rgb(250, 249, 245)';
export const LIME_50 = 'rgb(242, 240, 228)';

export const AMBIANT_A10 = 'rgb(239, 243, 245)';

export const ERROR_60 = 'rgb(217, 28, 28)';
export const ERROR_30 = 'rgb(255, 104, 104)';

export const WARNING_30 = 'rgb(234, 167, 43)';

/**
 * This function returns a unique hex color corresponding to the given index. The colors are
 * generated as #000001, #000002 ... #0000ff, #000100 etc.
 * These colors aim at representing the given indices on the picking layer.
 */
export function indexToColor(index: number): string {
  if (INDICES_TO_COLORS[index]) return INDICES_TO_COLORS[index];

  const color = `#${index.toString(16).padStart(6, '0')}`.toLowerCase();
  COLORS_TO_INDICES[color] = index;
  INDICES_TO_COLORS[index] = color;
  return color;
}

/**
 * This function returns the index corresponding to the given color.
 */
export function colorToIndex(color: string): number {
  return COLORS_TO_INDICES[color.toLowerCase()];
}

function componentToHex(c: number): string {
  return c.toString(16).padStart(2, '0').toLowerCase();
}
// The two following functions are just small helpers to help translating colors between RGB and
// Hex:
export function rgbToHex(r: number, g: number, b: number): string {
  return `#${componentToHex(r)}${componentToHex(g)}${componentToHex(b)}`;
}
export function hexToRgb(color: string): RGBAColor {
  return chroma(color).rgba();
}
