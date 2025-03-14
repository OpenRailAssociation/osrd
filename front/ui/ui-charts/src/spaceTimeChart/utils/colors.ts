import chroma from 'chroma-js';

import { type RGBAColor } from '../lib/types';

const COLORS_TO_INDICES: Record<string, number> = {};
const INDICES_TO_COLORS: Record<number, string> = {};

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
