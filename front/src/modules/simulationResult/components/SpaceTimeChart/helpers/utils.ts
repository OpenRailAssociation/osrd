import { chunk, noop, omit } from 'lodash';

import type {
  IndividualTrainProjection,
  LayerRangeData,
  TrainSpaceTimeData,
} from 'modules/simulationResult/types';
import type { OccurrenceId, TimetableItem, TrainScheduleId } from 'reducers/osrdconf/types';
import { isOccurrenceId, isTrainScheduleId } from 'utils/trainId';

import type { MovableOccupancyZone } from './zones';

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
  allIDs: string[],
  fetchTrackOccupancy: (ids: string[]) => Promise<MovableOccupancyZone[]>,
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
