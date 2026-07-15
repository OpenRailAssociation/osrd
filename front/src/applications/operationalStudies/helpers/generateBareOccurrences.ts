import {
  getOccurrencesNb,
  computeIndexedOccurrenceStartTime,
} from 'modules/trainSchedule/helpers/pacedTrain';
import type {
  PacedDetails,
  PacedTrainWithDetails,
  SimulatedException,
} from 'modules/trainSchedule/types';
import type { OccurrenceId } from 'reducers/osrdconf/types';
import { msToStartTime, type Duration, type StartTime } from 'utils/duration';
import {
  formatEditoastIdToIndexedOccurrenceId,
  formatEditoastIdToExceptionId,
} from 'utils/trainId';

export type BareOccurrence<T extends StartTime = StartTime> = {
  id: OccurrenceId;
  startTime: T;
  exception: SimulatedException | undefined;
};

/**
 * Given a paced train, generate basic details for all occurrences.
 *
 * Overloaded on the paced train's start time type so that callers still working with a
 * plain Date (e.g. TrainSpaceTimeData.departureTime, not yet adapted for hourly
 * timetables) get back a Date, while callers holding a StartTime (Date | Duration) get
 * back a StartTime.
 *
 * TODO Hourly timetables: this overload only exists for the migration. Once
 * TrainSpaceTimeData.departureTime (and the rest of the STD) is adapted to StartTime,
 * drop the Date-only overload and the BareOccurrence<T> generic, and type this function
 * with StartTime only.
 */
export function generateBareOccurrences(pacedTrain: {
  id: number;
  startTime: Date;
  paced: PacedDetails;
}): BareOccurrence<Date>[];
export function generateBareOccurrences(pacedTrain: {
  id: number;
  startTime: Duration;
  paced: PacedDetails;
}): BareOccurrence<Duration>[];
export function generateBareOccurrences(
  pacedTrain: Pick<PacedTrainWithDetails, 'id' | 'startTime' | 'paced'>
): BareOccurrence[];
export function generateBareOccurrences(
  pacedTrain: Pick<PacedTrainWithDetails, 'id' | 'startTime' | 'paced'>
): BareOccurrence[] {
  const occurrencesCount = getOccurrencesNb(pacedTrain.paced);
  const occurrences: BareOccurrence[] = [];
  for (let i = 0; i < occurrencesCount; i++) {
    const exception = pacedTrain.paced.exceptions.find((ex) => ex.occurrence_index === i);
    const startTime = exception?.start_time
      ? msToStartTime(exception.start_time.value, pacedTrain.startTime)
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
      startTime: msToStartTime(exception.start_time.value, pacedTrain.startTime),
      exception,
    });
  }

  return occurrences;
}
