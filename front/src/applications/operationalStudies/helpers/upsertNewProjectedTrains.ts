import type { TrainScheduleResponse } from 'common/api/osrdEditoastApi';
import type { BaseTrainProjection, TrainSpaceTimeData } from 'modules/simulationResult/types';
import { Duration } from 'utils/duration';

import type { ProjectionResult } from './TrainProjectionLazyLoaderAbstract';

/** Formats ProjectionResult into TrainSpaceTimeData and upsert into previous projectedTrains */
const upsertNewProjectedTrains = (
  projectedTrains: Map<number, TrainSpaceTimeData>,
  projectedTrainsToUpsert: Map<number, ProjectionResult>,
  trainSchedulesById: Map<number, TrainScheduleResponse>
) => {
  const newProjectedTrains = new Map(projectedTrains);

  // For each key (train, id) in projectedTrainsToUpsert, we either add it or update it in the state
  for (const [trainIdKey, trainData] of projectedTrainsToUpsert) {
    const matchingTrain = trainSchedulesById.get(trainIdKey);
    if (!matchingTrain) {
      continue;
    }

    const exceptionProjections = new Map<number, BaseTrainProjection>();
    if (trainData.exceptions) {
      for (const [exceptionId, exceptionProjectionData] of trainData.exceptions) {
        exceptionProjections.set(Number(exceptionId), {
          spaceTimeCurves: exceptionProjectionData.space_time_curves,
          signalUpdates: exceptionProjectionData.signal_updates,
        });
      }
    }

    const base = {
      name: matchingTrain?.train_name || 'Train name not found',
      departureTime: new Date(matchingTrain?.start_time),
      spaceTimeCurves: trainData.space_time_curves,
      signalUpdates: trainData.signal_updates || [],
      originPathItem: matchingTrain.path.at(0)!,
      destinationPathItem: matchingTrain.path.at(-1)!,
    };

    const projectedTrain: TrainSpaceTimeData = {
      ...base,
      id: matchingTrain.id,
      paced: matchingTrain.paced
        ? {
            timeWindow: Duration.parse(matchingTrain.paced.time_window),
            interval: Duration.parse(matchingTrain.paced.interval),
            exceptions: matchingTrain.paced.exceptions,
            exceptionProjections,
          }
        : undefined,
    };

    newProjectedTrains.set(trainIdKey, projectedTrain);
  }

  return newProjectedTrains;
};

export default upsertNewProjectedTrains;
