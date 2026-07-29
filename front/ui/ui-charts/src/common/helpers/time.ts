import { MINUTE } from '../consts';
import type { TimeToPixel, PixelToTime } from '../types';

/**
 * @param minT number timestamp
 * @param maxT number timestamp
 * @param timeRanges time frames (24h, 12h, 6h, …)
 * @param gridlinesLevels width of the lines for each time frame
 * @param formatter function to format de values inside the output object
 * Keys are times in ms
 * Values are the highest level on each time
 */
export function computeVisibleTimeMarkers<T extends object = { level: number }>(
  minT: number,
  maxT: number,
  timeRanges: number[],
  gridlinesLevels: number[],
  formatter: (level: number, i: number) => T = (level: number) => ({ level }) as T
): (T & { time: number })[] {
  const result: Record<number, T & { time: number }> = {};
  const minTLocalOffset = new Date(minT).getTimezoneOffset() * MINUTE;

  timeRanges.forEach((range, i) => {
    const gridlinesLevel = gridlinesLevels[i];

    if (!gridlinesLevel) return;

    let t = Math.floor((minT - minTLocalOffset) / range) * range + minTLocalOffset;
    while (t <= maxT) {
      if (t >= minT) {
        result[t] = { ...formatter(gridlinesLevel, i), time: t };
      }
      t += range;
    }
  });
  return Object.values(result);
}

/**
 * To get crisp horizontal or vertical lines on a canvas, we must draw them as thin as possible, in
 * terms of actual pixels on screen.
 * The best way for this is:
 * - To center lines 1, 3, 5... pixels wide in the middle of a pixel (0.5, 1.5, 2.5...)
 * - To center lines 2, 4, 6... pixels wide between two pixels (0, 1, 2, 3...)
 * Also, for HiDPi screens:
 * - To center lines of "integer thicknesses" between two screen pixels (0, 0.5, 1, 1.5, 2...)
 * - To center lines with `n + 0.5` thicknesses in the middle of a screen pixel (0.25, 0.75, 1.25, 1.75...)
 * @param rawCoordinate Any input coordinate to fix
 * @param lineWidth The width of the line to draw
 * @param devicePixelRatio
 */
export function getCrispLineCoordinate(
  rawCoordinate: number,
  lineWidth: number,
  devicePixelRatio = window.devicePixelRatio || 1
): number {
  const centerOffset = Math.ceil(lineWidth * devicePixelRatio) / devicePixelRatio / 2;
  return (
    Math.round((rawCoordinate - centerOffset) * devicePixelRatio) / devicePixelRatio + centerOffset
  );
}

// ========== Time Scaling ===========

// The following functions handle data translation to the time referential:
export function getTimeToPixel(
  timeOrigin: number,
  pixelOffset: number,
  timeScale: number
): TimeToPixel {
  return (time: number) => pixelOffset + (time - timeOrigin) / timeScale;
}

export function getPixelToTime(
  timeOrigin: number,
  pixelOffset: number,
  timeScale: number
): PixelToTime {
  return (timePixel: number) => (timePixel - pixelOffset) * timeScale + timeOrigin;
}
