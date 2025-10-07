import type { Conflict, OccupancyBlock } from '@osrd-project/ui-charts';
import { chunk, compact, noop, omit } from 'lodash';

import { ASPECT_LABELS_COLORS } from 'modules/simulationResult/consts';
import type {
  OccurrenceId,
  TimetableItem,
  TimetableItemId,
  TrainScheduleId,
} from 'reducers/osrdconf/types';
import { isOccurrenceId, isTrainScheduleId } from 'utils/trainId';

import type { MovableOccupancyZone } from './zones';
import type {
  AspectLabel,
  IndividualTrainProjection,
  LayerRangeData,
  PathOperationalPoint,
  TrainSpaceTimeData,
  WaypointsPanelData,
} from '../../../types';

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

/**
 * Fetches track occupancy data for a large list of IDs in small sequential batches, to avoid
 * overwhelming the server or API.
 */
export function batchFetchTrackOccupancy(
  allIDs: TimetableItemId[],
  fetchTrackOccupancy: (ids: TimetableItemId[]) => Promise<MovableOccupancyZone[]>,
  {
    batchSize = 50,
    onProgress = noop,
    onComplete = noop,
    onError = noop,
  }: {
    batchSize?: number;
    onProgress?: (allValuesYet: MovableOccupancyZone[]) => void;
    onComplete?: (allValues: MovableOccupancyZone[]) => void;
    onError?: (err: Error) => void;
  }
) {
  let isAborted = false;
  let allZones: MovableOccupancyZone[] = [];

  const handleAbort = () => {
    isAborted = true;
    allZones = [];
  };
  const handleError = (reason: unknown) => {
    handleAbort();
    onError(
      reason instanceof Error
        ? reason
        : new Error(`batchFetchTrackOccupancy failed`, { cause: reason })
    );
  };

  const load = async () => {
    for (const batch of chunk(allIDs, batchSize)) {
      const newValues = await fetchTrackOccupancy(batch);
      if (isAborted) return;

      allZones = allZones.concat(newValues);
      onProgress(allZones);
    }

    onComplete(allZones);
  };

  load().catch(handleError);

  return handleAbort;
}

/**
 * Check if the given timetable item is a TrainScheduleProjection.
 * @param timetableItem - The timetable item to check.
 */
export const isTrainScheduleProjection = (
  timetableItem: TrainSpaceTimeData
): timetableItem is Extract<TrainSpaceTimeData, { id: TrainScheduleId }> =>
  isTrainScheduleId(timetableItem.id);

export const isIndividualOccurrenceProjection = (
  trainProjection: IndividualTrainProjection
): trainProjection is Extract<IndividualTrainProjection, { id: OccurrenceId }> =>
  isOccurrenceId(trainProjection.id);

export const cutSpaceTimeChart = (
  projectedTrains: IndividualTrainProjection[],
  conflicts: Conflict[],
  operationalPoints: PathOperationalPoint[],
  waypointsPanelData?: WaypointsPanelData
) => {
  let filteredProjectPathTrainResult = projectedTrains;
  let filteredConflicts = conflicts;

  if (!waypointsPanelData || waypointsPanelData.filteredWaypoints.length < 2)
    return { filteredProjectPathTrainResult, filteredConflicts };

  const { filteredWaypoints } = waypointsPanelData;
  const firstPosition = filteredWaypoints.at(0)!.position;
  const lastPosition = filteredWaypoints.at(-1)!.position;

  if (firstPosition !== 0 || lastPosition !== operationalPoints.at(-1)!.position) {
    filteredProjectPathTrainResult = projectedTrains.map((train) => ({
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

          // TODO : remove reformatting the datas when https://github.com/OpenRailAssociation/osrd-ui/issues/694 is merged
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

          // TODO : remove reformatting the datas when https://github.com/OpenRailAssociation/osrd-ui/issues/694 is merged
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

    filteredConflicts = compact(
      conflicts.map((conflict) => cutSpaceTimeRect(conflict, firstPosition, lastPosition))
    );

    return { filteredProjectPathTrainResult, filteredConflicts };
  }

  return { filteredProjectPathTrainResult, filteredConflicts };
};

export const getOccupancyBlocks = (trains: IndividualTrainProjection[]): OccupancyBlock[] =>
  trains.flatMap((train) => {
    const departureTime = train.departureTime.getTime();

    return train.signalUpdates.map((block) => ({
      timeStart: departureTime + block.time_start,
      timeEnd: departureTime + block.time_end,
      spaceStart: block.position_start,
      spaceEnd: block.position_end,
      color: ASPECT_LABELS_COLORS[block.aspect_label as AspectLabel],
      blinking: block.blinking,
    }));
  });
