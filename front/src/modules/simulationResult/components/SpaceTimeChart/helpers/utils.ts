import { omit } from 'lodash';

import type { TimetableItem } from 'reducers/osrdconf/types';

import type { LayerRangeData } from '../../../types';

export const cutSpaceTimeRect = (
  range: LayerRangeData,
  minSpace: number,
  maxSpace: number
): LayerRangeData | null => {
  let { timeStart, timeEnd, spaceStart, spaceEnd } = range;

  if (spaceEnd <= minSpace || spaceStart >= maxSpace) {
    return null;
  }

  if (spaceStart < minSpace) {
    const interpolationFactor = (minSpace - spaceStart) / (spaceEnd - spaceStart);
    spaceStart = minSpace;
    timeStart += (timeEnd - timeStart) * interpolationFactor;
  }

  if (spaceEnd > maxSpace) {
    const interpolationFactor = (spaceEnd - maxSpace) / (spaceEnd - spaceStart);
    spaceEnd = maxSpace;
    timeEnd -= (timeEnd - timeStart) * interpolationFactor;
  }

  return {
    spaceStart,
    spaceEnd,
    timeStart,
    timeEnd,
  };
};

export const getWaypointsLocalStorageKey = (
  timetableId: number | undefined,
  projectionPath: TimetableItem['path'] | undefined
) => {
  // We need to remove the id because it can change for waypoints added by map click
  const simplifiedPath = projectionPath?.map((waypoint) => omit(waypoint, ['id', 'deleted']));

  return `PathOperationalPoints-${timetableId}-${JSON.stringify(simplifiedPath)}`;
};
