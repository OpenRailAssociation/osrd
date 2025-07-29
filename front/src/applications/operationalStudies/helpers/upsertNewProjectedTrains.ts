import type { OccurrenceProjection, TrainSpaceTimeData } from 'modules/simulationResult/types';
import { makeOccurrenceTime } from 'modules/timetableItem/components/Timetable/utils';
import computeOccurrenceName from 'modules/timetableItem/helpers/computeOccurrenceName';
import type { TimetableItem, TimetableItemId } from 'reducers/osrdconf/types';
import { Duration } from 'utils/duration';
import {
  formatPacedTrainIdToExceptionId,
  formatPacedTrainIdToIndexedOccurrenceId,
  isPacedTrainResponseWithPacedTrainId,
} from 'utils/trainId';

import type { RawProjectionResult } from './TrainProjectionLazyLoaderAbstract';

/**
 * formats raw ProjectionResult into TrainSpaceTimeData and upsert into previous projectedTrains
 */
const upsertNewProjectedTrains = (
  projectedTrains: Map<TimetableItemId, TrainSpaceTimeData>,
  projectedTrainsToUpsert: Map<TimetableItemId, RawProjectionResult>,
  timetableItemsById: Map<TimetableItemId, TimetableItem>
): Map<TimetableItemId, TrainSpaceTimeData> => {
  const newProjectedTrains = new Map(projectedTrains);

  // For each key (train, id) in projectPathTrainResult, we either add it or update it in the state
  for (const [trainIdKey, trainProjectionData] of projectedTrainsToUpsert) {
    const matchingTrain = timetableItemsById.get(trainIdKey);
    if (!matchingTrain) {
      continue;
    } else {
      const baseProjectionData = {
        name: matchingTrain?.train_name || 'Train name not found',
        departureTime: new Date(matchingTrain?.start_time),
        spaceTimeCurves: trainProjectionData.space_time_curves,
        signalUpdates: trainProjectionData.signal_updates || [],
      };
      // ======= paced train ==========
      if (isPacedTrainResponseWithPacedTrainId(matchingTrain)) {
        const pacedTrainExceptionsProjections: OccurrenceProjection[] = [];
        if (trainProjectionData.exceptions) {
          for (const [exceptionKey, exceptionProjectionData] of trainProjectionData.exceptions) {
            const matchingException = matchingTrain.exceptions.find(
              (exception) => exception.key === exceptionKey
            )!;

            const name = matchingException?.train_name
              ? matchingException.train_name.value
              : matchingException?.occurrence_index
                ? computeOccurrenceName(
                    matchingTrain.train_name,
                    matchingException.occurrence_index
                  )
                : `${matchingTrain.train_name}/+`;

            const departureTime = matchingException.start_time
              ? new Date(matchingException.start_time.value)
              : makeOccurrenceTime(
                  new Date(matchingTrain.start_time),
                  Duration.parse(matchingTrain.paced.interval),
                  // added_exception implies start time
                  // no start time implies it’s not added, so it’s indexed
                  matchingException.occurrence_index!
                );

            const id = matchingException?.occurrence_index
              ? formatPacedTrainIdToIndexedOccurrenceId(
                  matchingTrain.id,
                  matchingException.occurrence_index
                )
              : formatPacedTrainIdToExceptionId(matchingTrain.id, matchingException.key);
            const exceptionProjection = {
              name,
              departureTime,
              spaceTimeCurves: exceptionProjectionData.space_time_curves,
              signalUpdates: exceptionProjectionData.signal_updates,
              id,
              pacedTrainDepartureTime: new Date(matchingTrain.start_time),
            };
            pacedTrainExceptionsProjections.push(exceptionProjection);
          }
        }

        newProjectedTrains.set(trainIdKey, {
          ...baseProjectionData,
          id: matchingTrain.id,
          paced: {
            timeWindow: Duration.parse(matchingTrain.paced.time_window),
            interval: Duration.parse(matchingTrain.paced.interval),
          },
          exceptions: matchingTrain.exceptions,
          exceptionProjections: pacedTrainExceptionsProjections,
        });
      } else {
        // =========== trains schedule =============
        newProjectedTrains.set(trainIdKey, { ...baseProjectionData, id: matchingTrain.id });
      }
    }
  }
  return newProjectedTrains;
};

export default upsertNewProjectedTrains;
