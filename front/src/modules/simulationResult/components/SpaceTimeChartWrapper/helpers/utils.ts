import type { OccupancyBlock } from '@osrd-project/ui-charts';
import { chunk, noop, omit } from 'lodash';

import type { TrainScheduleResponse } from 'common/api/osrdEditoastApi';
import { ASPECT_LABELS_COLORS } from 'modules/simulationResult/consts';
import type { CurveStyleExceptionType } from 'modules/simulationResult/types';
import type { OccurrenceId, TrainId } from 'reducers/osrdconf/types';
import type { SelectedTrain } from 'reducers/simulationResults/types';
import { isOccurrenceId, extractTrainScheduleIdFromTrainId } from 'utils/trainId';

import type { AspectLabel, IndividualTrainProjection } from '../../../types';
import type { PanelSelectionMode } from '../CurveSelectionSidePanel';

export const getWaypointsLocalStorageKey = (
  timetableId: number | undefined,
  projectionPath: TrainScheduleResponse['path'] | undefined
) => {
  // We need to remove the id because it can change for waypoints added by map click
  const simplifiedPath = projectionPath?.map((waypoint) => omit(waypoint, ['id']));

  return `PathOperationalPoints-${timetableId}-${JSON.stringify(simplifiedPath)}`;
};

/**
 * Fetches data for a large list of IDs in small sequential batches, to avoid overwhelming the
 * server or API. Reports what has been gathered after each batch, and returns an abort function.
 */
export function batchFetch<Value>(
  allIDs: number[],
  fetchBatch: (ids: number[]) => Promise<Value[]>,
  {
    batchSize = 50,
    onProgress = noop,
    onComplete = noop,
    onError = noop,
  }: {
    batchSize?: number;
    onProgress?: (allValuesYet: Value[]) => void;
    onComplete?: (allValues: Value[]) => void;
    onError?: (err: Error) => void;
  }
) {
  let isAborted = false;
  let allValues: Value[] = [];

  const handleAbort = () => {
    isAborted = true;
    allValues = [];
  };
  const handleError = (reason: unknown) => {
    handleAbort();
    onError(reason instanceof Error ? reason : new Error('batchFetch failed', { cause: reason }));
  };

  const load = async () => {
    for (const batch of chunk(allIDs, batchSize)) {
      const newValues = await fetchBatch(batch);
      if (isAborted) return;

      allValues = allValues.concat(newValues);
      onProgress(allValues);
    }

    onComplete(allValues);
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

export const isTrainSelected = (
  trainId: TrainId,
  chart: 'std' | 'tod',
  exceptionTypes: CurveStyleExceptionType[],
  selection: SelectedTrain,
  selectionMode: PanelSelectionMode
) => {
  if (chart !== selection.by) {
    return false;
  }
  const trainScheduleId = extractTrainScheduleIdFromTrainId(trainId);
  const selectedTrainScheduleId = extractTrainScheduleIdFromTrainId(selection.id);
  if (trainScheduleId !== selectedTrainScheduleId) {
    return false;
  }
  switch (selectionMode) {
    case 'all':
      return true;
    case 'single':
      return trainId === selection.id;
    case 'compliant':
      return !exceptionTypes.includes(chart === 'std' ? 'start_time' : 'path_and_schedule');
  }
};
