import type { OccupancyBlock } from '@osrd-project/ui-charts';
import { chunk, noop, omit } from 'lodash';

import type { TrainScheduleResponse } from 'common/api/osrdEditoastApi';
import { ASPECT_LABELS_COLORS } from 'modules/simulationResult/consts';
import type { OccurrenceId } from 'reducers/osrdconf/types';
import { isOccurrenceId } from 'utils/trainId';

import type { AspectLabel, IndividualTrainProjection } from '../../../types';
import type { MovableOccupancyZone } from './zones';

export const getWaypointsLocalStorageKey = (
  timetableId: number | undefined,
  projectionPath: TrainScheduleResponse['path'] | undefined
) => {
  // We need to remove the id because it can change for waypoints added by map click
  const simplifiedPath = projectionPath?.map((waypoint) => omit(waypoint, ['id']));

  return `PathOperationalPoints-${timetableId}-${JSON.stringify(simplifiedPath)}`;
};

/**
 * Fetches track occupancy data for a large list of IDs in small sequential batches, to avoid
 * overwhelming the server or API.
 */
export function batchFetchTrackOccupancy(
  allIDs: number[],
  fetchTrackOccupancy: (ids: number[]) => Promise<MovableOccupancyZone[]>,
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

export const isIndividualOccurrenceProjection = (
  trainProjection: IndividualTrainProjection
): trainProjection is Extract<IndividualTrainProjection, { id: OccurrenceId }> =>
  isOccurrenceId(trainProjection.id);

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
