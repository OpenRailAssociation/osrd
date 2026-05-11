import type { TrainSchedule } from 'common/api/osrdEditoastApi';
import {
  extractOccurrenceDetailsFromPacedTrain,
  findExceptionWithOccurrenceId,
} from 'modules/trainSchedule/helpers/pacedTrain';
import type { PacedTrainWithDetails } from 'modules/trainSchedule/types';
import type { OccurrenceId, Train } from 'reducers/osrdconf/types';

/**
 * Apply occurrence-related properties to a paced train, so that the resulting paced train
 * can be given to the old edition modal.
 *
 * Loosely adapted from useOccurrenceActions' editOccurrence callback.
 *
 * TODO: This should be deleted as soon as we move away from the old edition modal and we don't
 * rely on the store state anymore.
 */
export function applyOccurrenceOnPacedTrain(
  originalPacedTrain: PacedTrainWithDetails,
  train: Train,
  occurrenceId: OccurrenceId
): PacedTrainWithDetails {
  if (!originalPacedTrain.paced) return originalPacedTrain;

  const occurrenceToUpdateException = findExceptionWithOccurrenceId(
    originalPacedTrain.paced.exceptions,
    occurrenceId
  );

  const rawPacedTrain: Omit<TrainSchedule, 'paced'> = {
    ...originalPacedTrain,
    train_name: train.train_name,
    speed_limit_tag: train.speed_limit_tag,
    rolling_stock_name: train.rolling_stock_name,
    start_time: train.start_time,
  };

  const {
    train_name,
    start_time,
    speed_limit_tag,
    rolling_stock_name: rollingStockName,
    ...occurrenceProps
  } = extractOccurrenceDetailsFromPacedTrain(
    rawPacedTrain,
    occurrenceToUpdateException?.change_groups
  );

  return {
    ...originalPacedTrain,
    ...occurrenceProps,
    name: train_name,
    startTime: new Date(start_time),
    speedLimitTag: speed_limit_tag ?? null,
    rollingStockName,
  };
}
