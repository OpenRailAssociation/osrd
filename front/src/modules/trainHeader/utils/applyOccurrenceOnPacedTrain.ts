import type { TrainSchedule } from 'common/api/osrdEditoastApi';
import {
  extractOccurrenceDetailsFromPacedTrain,
  findExceptionWithOccurrenceId,
} from 'modules/trainSchedule/helpers/pacedTrain';
import type { TrainScheduleWithDetails } from 'modules/trainSchedule/types';
import type { OccurrenceId, Train } from 'reducers/osrdconf/types';
import { msToStartTime } from 'utils/duration';

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
  originalTrainSchedule: TrainScheduleWithDetails,
  train: Train,
  occurrenceId: OccurrenceId
): TrainScheduleWithDetails {
  if (!originalTrainSchedule.paced) return originalTrainSchedule;

  const occurrenceToUpdateException = findExceptionWithOccurrenceId(
    originalTrainSchedule.paced.exceptions,
    occurrenceId
  );

  const rawPacedTrain: Omit<TrainSchedule, 'paced'> = {
    ...originalTrainSchedule,
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
  } = extractOccurrenceDetailsFromPacedTrain(rawPacedTrain, occurrenceToUpdateException);

  return {
    ...originalTrainSchedule,
    ...occurrenceProps,
    name: train_name,
    startTime: msToStartTime(start_time, originalTrainSchedule.startTime),
    speedLimitTag: speed_limit_tag ?? null,
    rollingStockName,
  };
}
