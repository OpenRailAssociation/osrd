import { type ReactNode } from 'react';

import { clamp } from 'lodash';

import {
  BASE_WAYPOINT_HEIGHT,
  MAX_ZOOM_MS_PER_PX,
  MAX_ZOOM_X,
  MIN_ZOOM_MS_PER_PX,
  MIN_ZOOM_X,
  MAX_ZOOM_Y,
  MIN_ZOOM_Y,
  MAX_ZOOM_MANCHETTE_HEIGHT_MILLIMETER,
} from '../consts';
import type { InteractiveWaypoint, Waypoint } from '../types';

export const zoomValueToTimeScale = (slider: number) =>
  MIN_ZOOM_MS_PER_PX * Math.pow(MAX_ZOOM_MS_PER_PX / MIN_ZOOM_MS_PER_PX, slider / 100);

export const timeScaleToZoomValue = (timeScale: number) =>
  (100 * Math.log(timeScale / MIN_ZOOM_MS_PER_PX)) /
  Math.log(MAX_ZOOM_MS_PER_PX / MIN_ZOOM_MS_PER_PX);

/**
 * min zoom is computed with manchette px height between first and last waypoint.
 * max zoom just the canvas drawing height (without the x-axis scale section)
 */
export const getExtremaScales = (
  drawingHeightWithoutTopPadding: number,
  drawingHeightWithoutBothPadding: number,
  pathLengthMillimeter: number
) => ({
  minZoomMillimeterPerPx: pathLengthMillimeter / drawingHeightWithoutBothPadding,
  maxZoomMillimeterPerPx: MAX_ZOOM_MANCHETTE_HEIGHT_MILLIMETER / drawingHeightWithoutTopPadding,
});

export const zoomValueToSpaceScale = (
  minZoomMillimeterPerPx: number,
  maxZoomMillimeterPerPx: number,
  slider: number
) =>
  minZoomMillimeterPerPx *
  Math.pow(
    maxZoomMillimeterPerPx / minZoomMillimeterPerPx,
    (slider - MIN_ZOOM_Y) / (MAX_ZOOM_Y - MIN_ZOOM_Y)
  );

export const spaceScaleToZoomValue = (
  minZoomMillimeterPerPx: number,
  maxZoomMillimeterPerPx: number,
  spaceScale: number
) =>
  ((MAX_ZOOM_Y - MIN_ZOOM_Y) * Math.log(spaceScale / minZoomMillimeterPerPx)) /
    Math.log(maxZoomMillimeterPerPx / minZoomMillimeterPerPx) +
  MIN_ZOOM_Y;

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

export const filterVisibleElements = (
  elements: Waypoint[],
  spaceScale: number,
  minScreenGap: number
): Waypoint[] => {
  // On-screen pixel position of a waypoint (spaceScale is mm/px). A constant origin offset
  // would cancel out in the comparison below, so we don't need it.
  const getScreenPosition = (waypoint: Waypoint) => waypoint.position / spaceScale;

  const firstElement = elements.at(0);
  const lastElement = elements.at(-1);
  if (!firstElement || !lastElement) return elements;

  const sortedElements = [...elements].sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0));
  const displayedElements: Waypoint[] = [firstElement, lastElement];

  for (const element of sortedElements) {
    const hasSpace = !displayedElements.some(
      (displayed) =>
        Math.abs(getScreenPosition(element) - getScreenPosition(displayed)) < minScreenGap
    );

    if (hasSpace) {
      displayedElements.push(element);
    }
  }

  return displayedElements.sort((a, b) => a.position - b.position);
};

export const selectWaypointsToDisplay = (
  waypoints: Waypoint[],
  { isProportional, spaceScale }: { isProportional: boolean; spaceScale: number }
): Waypoint[] => {
  if (waypoints.length < 2) return [];

  // display all waypoints in linear mode
  if (!isProportional) return waypoints;

  return filterVisibleElements(waypoints, spaceScale, BASE_WAYPOINT_HEIGHT);
};

/**
 * 2 modes for space scales
 * km (isProportional): { coefficient: gives a scale in meter/pixel }
 * linear: { size: height in pixel  } (each point distributed evenly along the height of manchette.)
 */
export const getScales = (
  waypoints: Waypoint[],
  { isProportional, yZoom, height }: { isProportional: boolean; yZoom: number; height: number },
  minZoomMillimeterPerPx: number,
  maxZoomMillimeterPerPx: number
) => {
  if (!waypoints.length) return [];

  if (waypoints.length === 1) {
    const waypoint = waypoints[0];
    return [
      {
        from: waypoint.position,
        to: waypoint.position,
        size: height || 1,
      },
    ];
  }

  if (!isProportional) {
    return waypoints.slice(0, -1).map((from, index) => {
      const to = waypoints[index + 1];

      return {
        from: from.position,
        to: to.position,
        size: BASE_WAYPOINT_HEIGHT * yZoom,
      };
    });
  }

  const from = waypoints.at(0)!.position;
  const to = waypoints.at(-1)!.position;

  const scaleCoeff = isProportional
    ? { coefficient: zoomValueToSpaceScale(minZoomMillimeterPerPx, maxZoomMillimeterPerPx, yZoom) }
    : { size: BASE_WAYPOINT_HEIGHT * (waypoints.length - 1) * yZoom };

  return [
    {
      from,
      to,
      ...scaleCoeff,
    },
  ];
};

export const isInteractiveWaypoint = (
  item: InteractiveWaypoint | ReactNode
): item is InteractiveWaypoint =>
  item !== null && typeof item === 'object' && 'id' in item && 'position' in item;
