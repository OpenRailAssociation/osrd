import type { Conflict } from '@osrd-project/ui-charts';
import { compact } from 'lodash';

import type {
  IndividualTrainProjection,
  ProjectionWaypoint,
  WaypointsPanelData,
  LayerRangeData,
} from 'modules/simulationResult/types';

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

const cutSpaceTimeCurves = (
  projectedTrains: IndividualTrainProjection[],
  conflicts: Conflict[],
  operationalPoints: ProjectionWaypoint[],
  waypointsPanelData?: WaypointsPanelData
) => {
  let cutProjectedTrains = projectedTrains;
  let cutConflicts = conflicts;

  if (
    !waypointsPanelData ||
    waypointsPanelData.filteredWaypoints.length < 2 ||
    operationalPoints.length < 2
  )
    return {
      cutProjectedTrains,
      cutConflicts,
    };

  const { filteredWaypoints } = waypointsPanelData;

  const firstPosition = filteredWaypoints.at(0)!.position;
  const lastPosition = filteredWaypoints.at(-1)!.position;

  if (firstPosition === 0 && lastPosition === operationalPoints.at(-1)!.position)
    return {
      cutProjectedTrains,
      cutConflicts,
    };

  // the first or the last waypoint has been hidden and the projections need to be shortened
  cutProjectedTrains = projectedTrains.map((train) => ({
    ...train,
    spaceTimeCurves: train.spaceTimeCurves.map(({ positions, times }) => {
      const cutPositions: number[] = [];
      const cutTimes: number[] = [];

      for (let i = 1; i < positions.length; i += 1) {
        const currentRange: LayerRangeData = {
          spaceStart: positions[i - 1],
          spaceEnd: positions[i],
          timeStart: times[i - 1],
          timeEnd: times[i],
        };

        const interpolatedRange = cutSpaceTimeRect(currentRange, firstPosition, lastPosition);

        // TODO : remove reformatting the data when https://github.com/OpenRailAssociation/osrd-ui/issues/694 is merged
        if (!interpolatedRange) continue;

        if (i === 1 || cutPositions.length === 0) {
          cutPositions.push(interpolatedRange.spaceStart);
          cutTimes.push(interpolatedRange.timeStart);
        }
        cutPositions.push(interpolatedRange.spaceEnd);
        cutTimes.push(interpolatedRange.timeEnd);
      }

      return {
        positions: cutPositions,
        times: cutTimes,
      };
    }),
    signalUpdates: compact(
      train.signalUpdates.map((signal) => {
        const updatedSignalRange = cutSpaceTimeRect(
          {
            spaceStart: signal.position_start,
            spaceEnd: signal.position_end,
            timeStart: signal.time_start,
            timeEnd: signal.time_end,
          },
          firstPosition,
          lastPosition
        );

        if (!updatedSignalRange) return null;

        // TODO : remove reformatting the data when https://github.com/OpenRailAssociation/osrd-ui/issues/694 is merged
        return {
          ...signal,
          position_start: updatedSignalRange.spaceStart,
          position_end: updatedSignalRange.spaceEnd,
          time_start: updatedSignalRange.timeStart,
          time_end: updatedSignalRange.timeEnd,
        };
      })
    ),
  }));

  cutConflicts = compact(
    conflicts.map((conflict) => cutSpaceTimeRect(conflict, firstPosition, lastPosition))
  );

  return {
    cutProjectedTrains,
    cutConflicts,
  };
};

export default cutSpaceTimeCurves;
