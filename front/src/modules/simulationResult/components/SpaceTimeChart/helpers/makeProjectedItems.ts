import dayjs from 'dayjs';

import type { IndividualTrainProjection, TrainSpaceTimeData } from 'modules/simulationResult/types';
import computeOccurrenceName from 'modules/timetableItem/helpers/computeOccurrenceName';
import {
  getOccurrencesNb,
  findExceptionWithOccurrenceId,
} from 'modules/timetableItem/helpers/pacedTrain';
import { isTrainScheduleProjection, formatPacedTrainIdToIndexedOccurrenceId } from 'utils/trainId';

/**
 * Turns trainSpaceTimeData (trainSchedules + pacedTrains) into individual train projection.
 * Extracts everything into one flat array.
 */
const makeProjectedItems = (projectPathTrainResult: TrainSpaceTimeData[]) =>
  projectPathTrainResult.flatMap<IndividualTrainProjection>((train) => {
    if (isTrainScheduleProjection(train)) {
      return train;
    }
    // TODO exceptions : handle added exceptions in issue https://github.com/OpenRailAssociation/osrd/issues/11476
    const occurrencesCount = getOccurrencesNb(train.paced);
    const occurrences = [];
    for (let i = 0; i < occurrencesCount; i += 1) {
      const occurrenceId = formatPacedTrainIdToIndexedOccurrenceId(train.id, i);
      const correspondingException = findExceptionWithOccurrenceId(train.exceptions, occurrenceId);
      // Disabled occurrences should not be projected
      if (correspondingException?.disabled) continue;

      const occurrenceStartTime = dayjs(train.departureTime)
        .add(i * train.paced.interval.ms, 'ms')
        .toDate();
      occurrences.push({
        ...train,
        id: occurrenceId,
        name: computeOccurrenceName(train.name, i),
        departureTime: occurrenceStartTime,
      });
    }
    return occurrences;
  });

export default makeProjectedItems;
