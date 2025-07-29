import type { BaseTrainProjection, TrainSpaceTimeData } from 'modules/simulationResult/types';
import type { TimetableItem, TimetableItemId } from 'reducers/osrdconf/types';
import { Duration } from 'utils/duration';
import { isPacedTrainResponseWithPacedTrainId } from 'utils/trainId';

import type { ProjectionResult } from './TrainProjectionLazyLoaderAbstract';

/** Formats ProjectionResult into TrainSpaceTimeData and upsert into previous projectedTrains */
const upsertNewProjectedTrains = (
  projectedTrains: Map<TimetableItemId, TrainSpaceTimeData>,
  projectedTrainsToUpsert: Map<TimetableItemId, ProjectionResult>,
  timetableItemsById: Map<TimetableItemId, TimetableItem>
) => {
  const newProjectedTrains = new Map(projectedTrains);

  // For each key (train, id) in projectPathTrainResult, we either add it or update it in the state
  for (const [trainIdKey, trainData] of projectedTrainsToUpsert) {
    const matchingTrain = timetableItemsById.get(trainIdKey);
    if (!matchingTrain) {
      continue;
    }

    const exceptionProjections = new Map<string, BaseTrainProjection>();
    if (isPacedTrainResponseWithPacedTrainId(matchingTrain) && trainData.exceptions) {
      for (const [exceptionKey, exceptionProjectionData] of trainData.exceptions) {
        exceptionProjections.set(exceptionKey, {
          spaceTimeCurves: exceptionProjectionData.space_time_curves,
          signalUpdates: exceptionProjectionData.signal_updates,
        });
      }
    }

    const projectedTrain: TrainSpaceTimeData = {
      name: matchingTrain?.train_name || 'Train name not found',
      departureTime: new Date(matchingTrain?.start_time),
      spaceTimeCurves: trainData.space_time_curves,
      signalUpdates: trainData.signal_updates || [],
      ...(isPacedTrainResponseWithPacedTrainId(matchingTrain)
        ? {
            id: matchingTrain.id,
            paced: {
              timeWindow: Duration.parse(matchingTrain.paced.time_window),
              interval: Duration.parse(matchingTrain.paced.interval),
            },
            exceptions: matchingTrain.exceptions,
            exceptionProjections,
          }
        : { id: matchingTrain.id }),
    };

    newProjectedTrains.set(trainIdKey, projectedTrain);
  }

  return newProjectedTrains;
};

export default upsertNewProjectedTrains;
