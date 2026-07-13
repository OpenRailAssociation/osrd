import { pick } from 'lodash';

import { generateBareOccurrences } from 'applications/operationalStudies/helpers/generateBareOccurrences';
import type { IndividualTrainProjection, TrainSpaceTimeData } from 'modules/simulationResult/types';
import computeOccurrenceName from 'modules/trainSchedule/helpers/computeOccurrenceName';
import {
  formatEditoastIdToTrainScheduleId,
  isIndexedOccurrenceId,
  extractOccurrenceIndexFromOccurrenceId,
} from 'utils/trainId';

const EXCEPTION_SUFFIX = '≠';

/**
 * Turns trainSpaceTimeData (unique trains + pacedTrains) into individual train projection.
 * Extracts everything into one flat array.
 */
const makeProjectedTrains = (trainScheduleProjections: TrainSpaceTimeData[]) =>
  trainScheduleProjections.flatMap<IndividualTrainProjection>((projectedTrain) => {
    const { paced } = projectedTrain;
    if (!paced) {
      return {
        ...projectedTrain,
        id: formatEditoastIdToTrainScheduleId(projectedTrain.id),
        type: 'trainSchedule',
      };
    }

    const pacedTrainCurves = pick(projectedTrain, [
      'spaceTimeCurves',
      'signalUpdates',
      'isSimulated',
    ]);

    return generateBareOccurrences({
      id: projectedTrain.id,
      startTime: projectedTrain.departureTime,
      paced,
    })
      .filter(({ exception }) => !exception?.disabled)
      .map(({ id, startTime: departureTime, exception }): IndividualTrainProjection => {
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

        if (exception) {
          // TODO_EXCEPTION: remove `!` when using TrainSchedulingException type
          const exceptionProjection = paced.exceptionProjections.get(exception.id!);

          return {
            ...(exceptionProjection ?? pacedTrainCurves),
            id,
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
            type: 'occurrence',
            name,
            departureTime,
          };
        }
      });
  });

export default makeProjectedTrains;
