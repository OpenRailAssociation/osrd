import type { CurveStyleExceptionType } from 'modules/simulationResult/types';
import {
  findExceptionWithOccurrenceId,
  isPacedTrainWithDetails,
} from 'modules/trainSchedule/helpers/pacedTrain';
import type { TrainScheduleWithDetails } from 'modules/trainSchedule/types';
import type { TrainId } from 'reducers/osrdconf/types';
import {
  isOccurrenceId,
  extractTrainScheduleIdFromOccurrenceId,
  extractEditoastIdFromTrainScheduleId,
} from 'utils/trainId';

/**
 * Returns every exception type the curve-style classifier cares about for a
 * given train (an exception can cumulate several). The classifier needs them
 * regardless of the chart: the compliant mode compares them to the type
 * relevant for the selection source (`start_time` for a STD selection,
 * `path_and_schedule` for a TOD one).
 */
const getTrainExceptionTypes = (
  trainSchedulesWithDetailsById: Map<number, TrainScheduleWithDetails>,
  trainId: TrainId
): CurveStyleExceptionType[] => {
  if (!isOccurrenceId(trainId)) return [];
  const trainScheduleId = extractEditoastIdFromTrainScheduleId(
    extractTrainScheduleIdFromOccurrenceId(trainId)
  );
  const trainSchedule = trainSchedulesWithDetailsById.get(trainScheduleId);
  if (!trainSchedule || !isPacedTrainWithDetails(trainSchedule)) return [];
  const exception = findExceptionWithOccurrenceId(trainSchedule.paced.exceptions, trainId);
  const exceptionTypes: CurveStyleExceptionType[] = [];
  if (exception?.start_time !== undefined) exceptionTypes.push('start_time');
  if (exception?.path_and_schedule !== undefined) exceptionTypes.push('path_and_schedule');
  return exceptionTypes;
};

export default getTrainExceptionTypes;
