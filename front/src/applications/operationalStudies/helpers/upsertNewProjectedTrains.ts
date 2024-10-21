import type { TrainSpaceTimeData } from 'applications/operationalStudies/types';
import { type ProjectPathTrainResult, type TrainScheduleResult } from 'common/api/osrdEditoastApi';

const upsertNewProjectedTrains = (
  projectedTrains: Map<number, TrainSpaceTimeData>,
  projectedTrainsToUpsert: Record<string, ProjectPathTrainResult>,
  trainSchedulesById: Map<number, TrainScheduleResult>
) => {
  const newProjectedTrains = new Map(projectedTrains);

  // For each key (train id) in projectPathTrainResult, we either add it or update it in the state
  Object.entries(projectedTrainsToUpsert).forEach(([trainIdKey, trainData]) => {
    const trainId = Number(trainIdKey);
    if (!trainData) {
      console.error(`Train ${trainId} not found in the projectedTrainsToUpsert`);
      return;
    }

    const matchingTrain = trainSchedulesById.get(trainId);
    const projectedTrain = {
      ...trainData,
      id: +trainId,
      name: matchingTrain?.train_name || 'Train name not found',
      departure_time: trainData.departure_time,
    };

    newProjectedTrains.set(trainId, projectedTrain);
  });

  return newProjectedTrains;
};

export default upsertNewProjectedTrains;
