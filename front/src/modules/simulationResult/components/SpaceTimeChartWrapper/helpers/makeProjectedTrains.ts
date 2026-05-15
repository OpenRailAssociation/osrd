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
const makeProjectedTrains = (trainScheduleProjections: TrainSpaceTimeData[]) =>
  trainScheduleProjections.flatMap<IndividualTrainProjection>((projectedTrain) => {
    const pacedTrainId = formatEditoastIdToPacedTrainId(projectedTrain.id);
    if (!projectedTrain.paced) {
      return { ...projectedTrain, id: pacedTrainId };
    }

    const occurrences: IndividualTrainProjection[] = [];
    const pacedTrainCurves = pick(projectedTrain, [
      'spaceTimeCurves',
      'signalUpdates',
      'isSimulated',
    ]);

    // =========== indexed occurrences ===========
    const occurrencesCount = getOccurrencesNb(projectedTrain.paced);
    for (let i = 0; i < occurrencesCount; i += 1) {
      const occurrenceId = formatPacedTrainIdToIndexedOccurrenceId(pacedTrainId, i);
      const correspondingException = findExceptionWithOccurrenceId(
        projectedTrain.paced.exceptions,
        occurrenceId
      );

      // Disabled occurrences should not be displayed
      if (correspondingException?.disabled) continue;

      if (!correspondingException) {
        occurrences.push({
          ...pacedTrainCurves,
          id: occurrenceId,
          name: computeOccurrenceName(projectedTrain.name, i),
          departureTime: computeIndexedOccurrenceStartTime(
            projectedTrain.departureTime,
            projectedTrain.paced.interval,
            i
          ),
        });
        continue;
      }

      const exceptionProjection = projectedTrain.paced.exceptionProjections.get(
        correspondingException.id! // TODO_EXCEPTION: remove `!` when using TrainSchedulingException type
      );

      const departureTime = correspondingException.start_time
        ? new Date(correspondingException.start_time.value)
        : computeIndexedOccurrenceStartTime(
            projectedTrain.departureTime,
            projectedTrain.paced.interval,
            i
          );

      const name = correspondingException?.train_name
        ? `${correspondingException.train_name.value}≠`
        : `${computeOccurrenceName(projectedTrain.name, i)}≠`;

      occurrences.push({
        ...(exceptionProjection ?? pacedTrainCurves),
        id: occurrenceId,
        name,
        departureTime,
        exception: correspondingException,
      });
    }

    // =========== added exceptions ===========
    for (const exception of projectedTrain.paced.exceptions) {
      if (Number.isInteger(exception.occurrence_index)) {
        // already done in the indexed occurrences loop above
        continue;
      }

      // Disabled occurrences should not be displayed
      if (exception.disabled) continue;

      if (!exception.start_time) throw new Error('added exception should have a start time');

      const id = formatEditoastIdToExceptionId({
        pacedTrainId: projectedTrain.id,
        exceptionId: exception.id!, // TODO_EXCEPTION: remove `!` when using TrainSchedulingException type
      });
      const name = exception.train_name
        ? `${exception.train_name.value}≠`
        : `${projectedTrain.name}/+≠`;

      occurrences.push({
        ...(projectedTrain.paced.exceptionProjections.get(exception.id!) ?? pacedTrainCurves), // TODO_EXCEPTION: remove `!` when using TrainSchedulingException type
        id,
        name,
        departureTime: new Date(exception.start_time.value),
        exception,
      });
    }
    return occurrences;
  });

export default makeProjectedTrains;
