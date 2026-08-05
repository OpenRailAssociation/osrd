import { clamp } from 'lodash';

import {
  MAX_ZOOM_MS_PER_PX,
  MAX_ZOOM_X,
  MIN_ZOOM_MS_PER_PX,
  MIN_ZOOM_X,
} from '../../manchette/consts';
import type { Point, RGBAColor, RGBColor } from '../types';

// ============= Canvas ==============

/**
 * This function returns the picking layers scaling ratio. We basically take the min of the screen
 * pixels and the "HTML pixels", and divide it by two.
 *
 * This allows having a smaller picking stage to fill (so it's faster), while keeping a "good enough
 * precision".
 */
export function getPickingScalingRatio(): number {
  const PICKING_DOWNSCALING_RATIO = 0.5;
  const dpr = window.devicePixelRatio || 1;

  // When devicePixelRatio is over 1 (like for Retina displays), we downscale based on the "HTML
  // pixels":
  if (dpr > 1) return PICKING_DOWNSCALING_RATIO;

  // When devicePixelRatio is under or equal to 1 (like when the user zooms out for instance), we
  // downscale based on the actual "screen pixels" (to avoid having a too large scene to fill):
  return PICKING_DOWNSCALING_RATIO * dpr;
}

export function drawAliasedRect(
  imageData: ImageData,
  { x, y }: Point,
  width: number,
  height: number,
  [r, g, b]: RGBColor | RGBAColor,
  scalingRatio = 1
) {
  x = Math.round(x * scalingRatio);
  y = Math.round(y * scalingRatio);
  width = Math.round(width * scalingRatio);
  height = Math.round(height * scalingRatio);

  const xMin = clamp(x, 0, imageData.width);
  const yMin = clamp(y, 0, imageData.height);
  const xMax = clamp(x + width, 0, imageData.width);
  const yMax = clamp(y + height, 0, imageData.height);

  for (let i = xMin; i < xMax; i++) {
    for (let j = yMin; j < yMax; j++) {
      const index = (j * imageData.width + i) * 4;
      imageData.data[index] = r;
      imageData.data[index + 1] = g;
      imageData.data[index + 2] = b;
      imageData.data[index + 3] = 255;
    }
  }
}

// ============= EVENTS ==============

/**
 * This function takes a MouseEvent and an HTMLElement, and returns the position of the mouse,
 * relatively to the DOM element. This allows for instance dragging an element that is on the given
 * DOM element while the events are bound to the document or the body.
 */
export function getEventPosition(e: MouseEvent, dom: HTMLElement): Point {
  const bbox = dom.getBoundingClientRect();

  return {
    x: e.clientX - bbox.left,
    y: e.clientY - bbox.top,
  };
}

/**
 * This function returns a delta value for a given WheelEvent. It can be very useful, since the
 * given `deltaY` and `detail` attributes are not normalized.
 */
export function getEventWheelDelta(e: WheelEvent): number {
  if (typeof e.deltaY !== 'undefined') return (e.deltaY * -3) / 360;
  if (typeof e.detail !== 'undefined') return e.detail / -9;

  throw new Error('Could not extract delta from event.');
}

export const zoomValueToTimeScale = (slider: number) =>
  MIN_ZOOM_MS_PER_PX * Math.pow(MAX_ZOOM_MS_PER_PX / MIN_ZOOM_MS_PER_PX, slider / 100);

export const timeScaleToZoomValue = (timeScale: number) =>
  (100 * Math.log(timeScale / MIN_ZOOM_MS_PER_PX)) /
  Math.log(MAX_ZOOM_MS_PER_PX / MIN_ZOOM_MS_PER_PX);

/** Zoom on X axis and center on the mouse position */
export const zoomX = (
  currentZoom: number,
  currentOffset: number,
  newZoom: number,
  position: number
) => {
  const boundedZoom = clamp(newZoom, MIN_ZOOM_X, MAX_ZOOM_X);
  const oldTimeScale = zoomValueToTimeScale(currentZoom);
  const newTimeScale = zoomValueToTimeScale(boundedZoom);
  const newOffset = position - ((position - currentOffset) * oldTimeScale) / newTimeScale;
  return {
    xZoom: boundedZoom,
    xOffset: newOffset,
  };
};

export function getDistance(a: Point, b: Point): Point {
  return {
    x: b.x - a.x,
    y: b.y - a.y,
  };
}
