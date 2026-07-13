import {
  getOccurrencesNb,
  computeIndexedOccurrenceStartTime,
} from 'modules/trainSchedule/helpers/pacedTrain';
import type { PacedTrainWithDetails, SimulatedException } from 'modules/trainSchedule/types';
import type { OccurrenceId } from 'reducers/osrdconf/types';
import {
  formatEditoastIdToIndexedOccurrenceId,
  formatEditoastIdToExceptionId,
} from 'utils/trainId';

export type BareOccurrence = {
  id: OccurrenceId;
  startTime: Date;
  exception: SimulatedException | undefined;
};

/**
 * Given a paced train, generate basic details for all occurrences.
 */
export function generateBareOccurrences(
  pacedTrain: Pick<PacedTrainWithDetails, 'id' | 'startTime' | 'paced'>
): BareOccurrence[] {
  const occurrencesCount = getOccurrencesNb(pacedTrain.paced);
  const occurrences: BareOccurrence[] = [];
  for (let i = 0; i < occurrencesCount; i++) {
    const exception = pacedTrain.paced.exceptions.find((ex) => ex.occurrence_index === i);
    const startTime = exception?.start_time
      ? new Date(exception.start_time.value)
      : computeIndexedOccurrenceStartTime(pacedTrain.startTime, pacedTrain.paced.interval, i);

    occurrences.push({
      id: formatEditoastIdToIndexedOccurrenceId({
        trainScheduleId: pacedTrain.id,
        occurrenceIndex: i,
      }),
      startTime,
      exception,
    });
  }

  for (const exception of pacedTrain.paced.exceptions) {
    if (exception.occurrence_index !== undefined) {
      continue;
    }
    // TODO_EXCEPTION: remove this error case when ID becomes mandatory
    if (exception.id === undefined || exception.id === null) {
      throw new Error('Exception ID must be defined');
    }
    if (!exception.start_time) {
      throw new Error('Added exception must have a start_time change group');
    }
    occurrences.push({
      id: formatEditoastIdToExceptionId({
        trainScheduleId: pacedTrain.id,
        exceptionId: exception.id,
      }),
      startTime: new Date(exception.start_time.value),
      exception,
    });
  }

  return occurrences;
}
