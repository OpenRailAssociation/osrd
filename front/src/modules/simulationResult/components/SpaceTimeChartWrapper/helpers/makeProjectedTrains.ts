import { pick } from 'lodash';

import {
  generateBareOccurrences,
  type BareOccurrence,
} from 'applications/operationalStudies/helpers/generateBareOccurrences';
import getTrainScheduleRepeatOffsets, {
  type TimeRange,
} from 'modules/simulationResult/helpers/getTrainScheduleRepeatOffsets';
import type { IndividualTrainProjection, TrainSpaceTimeData } from 'modules/simulationResult/types';
import computeOccurrenceName from 'modules/trainSchedule/helpers/computeOccurrenceName';
import { addDurationToDate } from 'utils/duration';
import {
  formatEditoastIdToTrainScheduleId,
  isIndexedOccurrenceId,
  extractOccurrenceIndexFromOccurrenceId,
} from 'utils/trainId';

export const EXCEPTION_SUFFIX = '≠';

function repeatOccurrencesInRange(
  projectedTrain: TrainSpaceTimeData,
  occurrences: BareOccurrence<Date>[],
  timeRange: TimeRange
): BareOccurrence<Date>[] {
  const repeatOffsets = getTrainScheduleRepeatOffsets(projectedTrain, timeRange);

  const repeatedOccurrences: BareOccurrence<Date>[] = [];
  for (const offset of repeatOffsets) {
    for (const occurrence of occurrences) {
      repeatedOccurrences.push({
        ...occurrence,
        startTime: addDurationToDate(occurrence.startTime, offset),
      });
    }
  }

  return repeatedOccurrences;
}

/**
 * Turns trainSpaceTimeData (unique trains + pacedTrains) into individual train projection.
 * Extracts everything into one flat array.
 */
const makeProjectedTrains = (
  trainScheduleProjections: TrainSpaceTimeData[],
  repeatTimeRange?: TimeRange
) =>
  trainScheduleProjections.flatMap<IndividualTrainProjection>((projectedTrain) => {
    const { paced } = projectedTrain;
    if (!paced) {
      const id = formatEditoastIdToTrainScheduleId(projectedTrain.id);
      return {
        ...projectedTrain,
        id,
        key: id,
        type: 'trainSchedule',
      };
    }

    const pacedTrainCurves = pick(projectedTrain, [
      'spaceTimeCurves',
      'signalUpdates',
      'isSimulated',
    ]);

    let bareOccurrences = generateBareOccurrences({
      id: projectedTrain.id,
      startTime: projectedTrain.departureTime,
      paced,
    }).filter(({ exception }) => !exception?.disabled);

    if (repeatTimeRange) {
      bareOccurrences = repeatOccurrencesInRange(projectedTrain, bareOccurrences, repeatTimeRange);
    }

    return bareOccurrences.map(
      ({ id, startTime: departureTime, exception }): IndividualTrainProjection => {
        let name = exception?.train_name?.value;
        if (isIndexedOccurrenceId(id)) {
          name ??= computeOccurrenceName(
            projectedTrain.name,
            extractOccurrenceIndexFromOccurrenceId(id)
          );
        } else {
          name ??= projectedTrain.name + '/+';
        }
        if (exception) {
          name += EXCEPTION_SUFFIX;
        }

        const key = `${id}-${departureTime.toISOString()}`;

        if (exception) {
          // TODO_EXCEPTION: remove `!` when using TrainSchedulingException type
          const exceptionProjection = paced.exceptionProjections.get(exception.id!);

          return {
            ...(exceptionProjection ?? pacedTrainCurves),
            id,
            key,
            type: 'exception',
            name,
            departureTime,
            exception,
          };
        } else {
          if (!isIndexedOccurrenceId(id)) {
            throw new Error('Occurrence without exception must be indexed');
          }
          return {
            ...pacedTrainCurves,
            id,
            key,
            type: 'occurrence',
            name,
            departureTime,
          };
        }
      }
    );
  });

export default makeProjectedTrains;
