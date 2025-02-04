import type { TrainSpaceTimeData } from 'applications/operationalStudies/types';
import { type ProjectPathTrainResult } from 'common/api/osrdEditoastApi';
import type {
  TrainId,
  TrainScheduleId,
  TrainScheduleResultWithTrainId,
} from 'reducers/osrdconf/types';

const upsertNewProjectedTrains = (
  projectedTrains: Map<TrainId, TrainSpaceTimeData>,
  projectedTrainsToUpsert: Record<TrainScheduleId, ProjectPathTrainResult>,
  trainSchedulesById: Map<TrainScheduleId, TrainScheduleResultWithTrainId>
) => {
  const newProjectedTrains = new Map(projectedTrains);

  // For each key (train id) in projectPathTrainResult, we either add it or update it in the state
  Object.entries(projectedTrainsToUpsert).forEach(([trainIdKey, trainData]) => {
    if (!trainData) {
      console.error(`Train ${trainIdKey} not found in the projectedTrainsToUpsert`);
      return;
    }

    // trainIdKey is in format TrainScheduleId but Object.entries tells typescript it's a string
    const matchingTrain = trainSchedulesById.get(trainIdKey as TrainScheduleId);
    const projectedTrain = {
      id: trainIdKey as TrainScheduleId,
      name: matchingTrain?.train_name || 'Train name not found',
      departureTime: new Date(trainData.departure_time),
      spaceTimeCurves: trainData.space_time_curves,
      signalUpdates: trainData.signal_updates,
    };

    newProjectedTrains.set(trainIdKey as TrainScheduleId, projectedTrain);
  });

  return newProjectedTrains;
};

export default upsertNewProjectedTrains;
