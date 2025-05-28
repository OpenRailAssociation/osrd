import { chunk, noop, omit } from 'lodash';

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

/**
 * Fetches data for a large list of IDs in small batches, to avoid overwhelming
 * the server or API. Processes batches sequentially, with animation frame
 * timing to prevent stack overflows.
 */
export function batchFetch<T>(
  allIDs: string[],
  fetchValues: (ids: string[]) => Promise<T[]>,
  {
    batchSize = 50,
    onProgress = noop,
    onComplete = noop,
    onError = noop,
  }: {
    batchSize?: number;
    onProgress?: (allValuesYet: T[]) => void;
    onComplete?: (allValues: T[]) => void;
    onError?: (err: Error) => void;
  }
) {
  let isAborted = false;
  let frameId: number | null = null;
  let allValues: T[] = [];
  const handleAbort = () => {
    isAborted = true;
    allValues = [];
    if (typeof frameId === 'number') cancelAnimationFrame(frameId);
  };
  const handleError = (reason: unknown) => {
    handleAbort();
    onError(reason instanceof Error ? reason : new Error(`batchFetch failed`, { cause: reason }));
  };

  const idsBatches = chunk(allIDs, batchSize);
  const shiftBatch = async () => {
    // Check abort before checking next batch
    // (so that onComplete is not called once aborted)
    if (isAborted) return;

    frameId = null;
    const batch = idsBatches.shift();
    if (!batch?.length) {
      onComplete(allValues);
      return;
    }

    const newValues = await fetchValues(batch);
    // Check abort again, once the data is fetched
    // (so that onProgress and handleError are not called once aborted)
    if (isAborted) return;

    allValues = allValues.concat(newValues);
    onProgress(allValues);

    frameId = requestAnimationFrame(() => shiftBatch().catch(handleError));
  };

  shiftBatch().catch(handleError);

  return handleAbort;
}
