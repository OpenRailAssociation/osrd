/* eslint-disable @typescript-eslint/no-unsafe-return */
import { pick } from 'lodash';

import type {
  IndividualTrainProjection,
  OccurrenceProjection,
  TrainSpaceTimeData,
} from 'modules/simulationResult/types';
import { makeOccurrenceTime } from 'modules/timetableItem/components/Timetable/utils';
import computeOccurrenceName from 'modules/timetableItem/helpers/computeOccurrenceName';
import {
  findExceptionWithOccurrenceId,
  getOccurrencesNb,
} from 'modules/timetableItem/helpers/pacedTrain';
import {
  formatPacedTrainIdToIndexedOccurrenceId,
  isTrainScheduleProjection,
  formatEditoastIdToExceptionId,
  extractEditoastIdFromPacedTrainId,
  extractOccurrenceIndexFromOccurrenceId,
  isIndexedOccurrenceId,
  extractExceptionIdFromOccurrenceId,
  isAddedExceptionId,
} from 'utils/trainId';

/**
 * Turns trainSpaceTimeData (trainSchedules + pacedTrains) into individual train projection.
 * Extracts everything into one flat array.
 */
export default function makeProjectedItems(projectPathTrainResult: TrainSpaceTimeData[]) {
  return projectPathTrainResult.flatMap<IndividualTrainProjection>((projectedItem) => {
    if (isTrainScheduleProjection(projectedItem)) {
      return projectedItem;
    }
    // ==== paced train ====
    const pacedTrainId = extractEditoastIdFromPacedTrainId(projectedItem.id);
    const occurrences: OccurrenceProjection[] = [];
    // ========= indexed occurrences =========
    const occurrencesCount = getOccurrencesNb(projectedItem.paced);
    for (let i = 0; i < occurrencesCount; i += 1) {
      const occurrenceId = formatPacedTrainIdToIndexedOccurrenceId(projectedItem.id, i);
      const correspondingException = findExceptionWithOccurrenceId(
        projectedItem.exceptions,
        occurrenceId
      );
      // Disabled occurrences should not be projected
      if (correspondingException?.disabled) continue;

      const departureTime = correspondingException?.start_time
        ? new Date(correspondingException.start_time.value)
        : makeOccurrenceTime(projectedItem.departureTime, projectedItem.paced.interval, i);
      const exceptionProjection = projectedItem.exceptionProjections.find((proj) => {
        if (!isIndexedOccurrenceId(proj.id)) {
          return false;
        }
        return (
          extractOccurrenceIndexFromOccurrenceId(proj.id) ===
          correspondingException?.occurrence_index
        );
      });
      const name = correspondingException?.train_name
        ? correspondingException.train_name.value
        : computeOccurrenceName(projectedItem.name, i);

      const isStartTimeException = Boolean(correspondingException?.start_time);
      const pacedTrainData = pick(projectedItem, [
        'departureTime',
        'spaceTimeCurves',
        'signalUpdates',
      ]);
      occurrences.push({
        ...(exceptionProjection ?? pacedTrainData),
        id: occurrenceId,
        name,
        departureTime,
        isStartTimeException,
        pacedTrainDepartureTime: projectedItem.departureTime,
      });
    }

    // ========= added exceptions =========
    for (const exception of projectedItem.exceptions) {
      if (Number.isInteger(exception.occurrence_index)) {
        // already done in the indexed occurrences loop above
        continue;
      }
      const id = formatEditoastIdToExceptionId({ pacedTrainId, exceptionId: exception.key });
      const name = exception.train_name ? exception.train_name.value : `${projectedItem.name}/+`;
      const exceptionProjection = projectedItem.exceptionProjections.find(
        (ex) =>
          isAddedExceptionId(ex.id) && extractExceptionIdFromOccurrenceId(ex.id) === exception.key
      );
      if (!exception.start_time) {
        throw new Error('added exception should have a start time');
      }
      const departureTime = new Date(exception.start_time.value);

      occurrences.push({
        ...(exceptionProjection ?? projectedItem),
        id,
        name,
        departureTime,
        isStartTimeException: true,
        pacedTrainDepartureTime: projectedItem.departureTime,
      });
    }
    return occurrences;
  });
}
