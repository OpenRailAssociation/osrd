import { type ReactNode } from 'react';

import {
  BASE_WAYPOINT_HEIGHT,
  MAX_ZOOM_Y,
  MIN_ZOOM_Y,
  MAX_ZOOM_MANCHETTE_HEIGHT_MILLIMETER,
} from '../consts';
import type { InteractiveWaypoint, Waypoint } from '../types';

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

export const selectWaypointsToDisplay = (
  waypoints: Waypoint[],
  { isProportional, spaceScale }: { isProportional: boolean; spaceScale: number }
): Waypoint[] => {
  if (waypoints.length < 2) return [];

  // display all waypoints in linear mode
  if (!isProportional) return waypoints;

  // In proportional mode, hide waypoints whose labels (BASE_WAYPOINT_HEIGHT px tall) would
  // overlap at the current zoom. spaceScale is mm/px, so a waypoint's on-screen position is
  // position / spaceScale (a because both scales start at zero).
  const getScreenPosition = (waypoint: Waypoint) => waypoint.position / spaceScale;

  // always keep the first and last waypoints, then greedily keep the highest-weight ones
  // that still have room
  const [firstWaypoint] = waypoints;
  const lastWaypoint = waypoints.at(-1)!;
  const displayedWaypoints: Waypoint[] = [firstWaypoint, lastWaypoint];

  const waypointsByWeight = [...waypoints].sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0));
  for (const waypoint of waypointsByWeight) {
    const hasSpace = !displayedWaypoints.some(
      (displayed) =>
        Math.abs(getScreenPosition(waypoint) - getScreenPosition(displayed)) < BASE_WAYPOINT_HEIGHT
    );

    if (hasSpace) {
      displayedWaypoints.push(waypoint);
    }
  }

  return displayedWaypoints.sort((a, b) => a.position - b.position);
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
