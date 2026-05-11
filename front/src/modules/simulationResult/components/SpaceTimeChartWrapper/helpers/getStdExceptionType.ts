import type { CurveStyleExceptionType } from 'modules/simulationResult/types';
import {
  findExceptionWithOccurrenceId,
  isPacedTrainWithDetails,
} from 'modules/trainSchedule/helpers/pacedTrain';
import type { TrainScheduleWithDetails } from 'modules/trainSchedule/types';
import type { TrainId } from 'reducers/osrdconf/types';
import {
  isOccurrenceId,
  extractPacedTrainIdFromOccurrenceId,
  extractEditoastIdFromPacedTrainId,
} from 'utils/trainId';

/**
 * Returns the exception type the STD classifier cares about for a given
 * train. A `start_time` change is the only one that affects the curve in
 * this chart; the TOD will have its own helper for `path_and_schedule`.
 */
const getStdExceptionType = (
  trainSchedulesWithDetailsById: Map<number, TrainScheduleWithDetails>,
  trainId: TrainId
): CurveStyleExceptionType | undefined => {
  if (!isOccurrenceId(trainId)) return undefined;
  const trainScheduleId = extractEditoastIdFromPacedTrainId(
    extractPacedTrainIdFromOccurrenceId(trainId)
  );
  const trainSchedule = trainSchedulesWithDetailsById.get(trainScheduleId);
  if (!trainSchedule || !isPacedTrainWithDetails(trainSchedule)) return undefined;
  const exception = findExceptionWithOccurrenceId(trainSchedule.paced.exceptions, trainId);
  return exception?.change_groups.start_time ? 'start_time' : undefined;
};

export default getStdExceptionType;
