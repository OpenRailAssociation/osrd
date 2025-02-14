import type { TrainSpaceTimeData } from 'applications/operationalStudies/types';
import { type ProjectPathTrainResult } from 'common/api/osrdEditoastApi';
import type {
  TrainId,
  TrainScheduleId,
  TrainScheduleResultWithTrainId,
} from 'reducers/osrdconf/types';

const upsertNewProjectedTrains = (
  projectedTrains: Map<TrainId, TrainSpaceTimeData>,
  projectedTrainsToUpsert: Map<TrainScheduleId, ProjectPathTrainResult>,
  trainSchedulesById: Map<TrainScheduleId, TrainScheduleResultWithTrainId>
) => {
  const newProjectedTrains = new Map(projectedTrains);

  // For each key (train id) in projectPathTrainResult, we either add it or update it in the state
  for (const [trainIdKey, trainData] of projectedTrainsToUpsert) {
    const matchingTrain = trainSchedulesById.get(trainIdKey);
    const projectedTrain = {
      id: trainIdKey,
      name: matchingTrain?.train_name || 'Train name not found',
      departureTime: new Date(trainData.departure_time),
      spaceTimeCurves: trainData.space_time_curves,
      signalUpdates: trainData.signal_updates,
    };

    newProjectedTrains.set(trainIdKey, projectedTrain);
  }

  return newProjectedTrains;
};

export default upsertNewProjectedTrains;
