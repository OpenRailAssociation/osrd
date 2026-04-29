import { pick } from 'lodash';

import type { IndividualTrainProjection, TrainSpaceTimeData } from 'modules/simulationResult/types';
import computeOccurrenceName from 'modules/trainSchedule/helpers/computeOccurrenceName';
import {
  computeIndexedOccurrenceStartTime,
  findExceptionWithOccurrenceId,
  getOccurrencesNb,
} from 'modules/trainSchedule/helpers/pacedTrain';
import {
  formatPacedTrainIdToIndexedOccurrenceId,
  formatEditoastIdToExceptionId,
  formatEditoastIdToPacedTrainId,
} from 'utils/trainId';

/**
 * Turns trainSpaceTimeData (unique trains + pacedTrains) into individual train projection.
 * Extracts everything into one flat array.
 */
const makeProjectedItems = (timetableItemProjections: TrainSpaceTimeData[]) =>
  timetableItemProjections.flatMap<IndividualTrainProjection>((projectedItem) => {
    const pacedTrainId = formatEditoastIdToPacedTrainId(projectedItem.id);
    if (!projectedItem.paced) {
      return { ...projectedItem, id: pacedTrainId };
    }

    const occurrences: IndividualTrainProjection[] = [];
    const pacedTrainCurves = pick(projectedItem, [
      'spaceTimeCurves',
      'signalUpdates',
      'isSimulated',
    ]);

    // =========== indexed occurrences ===========
    const occurrencesCount = getOccurrencesNb(projectedItem.paced);
    for (let i = 0; i < occurrencesCount; i += 1) {
      const occurrenceId = formatPacedTrainIdToIndexedOccurrenceId(pacedTrainId, i);
      const correspondingException = findExceptionWithOccurrenceId(
        projectedItem.paced.exceptions,
        occurrenceId
      );

      // Disabled occurrences should not be displayed
      if (correspondingException?.disabled) continue;

      if (!correspondingException) {
        occurrences.push({
          ...pacedTrainCurves,
          id: occurrenceId,
          name: computeOccurrenceName(projectedItem.name, i),
          departureTime: computeIndexedOccurrenceStartTime(
            projectedItem.departureTime,
            projectedItem.paced.interval,
            i
          ),
        });
        continue;
      }

      const exceptionProjection = projectedItem.paced.exceptionProjections.get(
        correspondingException.id! // TODO_EXCEPTION: remove `!` when using TrainSchedulingException type
      );

      const departureTime = correspondingException.start_time
        ? new Date(correspondingException.start_time.value)
        : computeIndexedOccurrenceStartTime(
            projectedItem.departureTime,
            projectedItem.paced.interval,
            i
          );

      const name = correspondingException?.train_name
        ? correspondingException.train_name.value
        : computeOccurrenceName(projectedItem.name, i);

      occurrences.push({
        ...(exceptionProjection ?? pacedTrainCurves),
        id: occurrenceId,
        name,
        departureTime,
        exception: correspondingException,
      });
    }

    // =========== added exceptions ===========
    for (const exception of projectedItem.paced.exceptions) {
      if (Number.isInteger(exception.occurrence_index)) {
        // already done in the indexed occurrences loop above
        continue;
      }

      // Disabled occurrences should not be displayed
      if (exception.disabled) continue;

      if (!exception.start_time) throw new Error('added exception should have a start time');

      const id = formatEditoastIdToExceptionId({
        pacedTrainId: projectedItem.id,
        exceptionId: exception.id!, // TODO_EXCEPTION: remove `!` when using TrainSchedulingException type
      });
      const name = exception.train_name ? exception.train_name.value : `${projectedItem.name}/+`;

      occurrences.push({
        ...(projectedItem.paced.exceptionProjections.get(exception.id!) ?? pacedTrainCurves), // TODO_EXCEPTION: remove `!` when using TrainSchedulingException type
        id,
        name,
        departureTime: new Date(exception.start_time.value),
        exception,
      });
    }
    return occurrences;
  });

export default makeProjectedItems;
