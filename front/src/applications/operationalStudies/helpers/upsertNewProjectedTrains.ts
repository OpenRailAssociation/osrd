import type { TrainSpaceTimeData } from 'applications/operationalStudies/types';
import { type ProjectPathTrainResult, type TrainScheduleResult } from 'common/api/osrdEditoastApi';
import { convertIsoUtcToLocalTime } from 'utils/date';

// TODO: feed the spaceTimeChart with date instead of formatted string
export const formatDatetimeForSpaceTimeChart = (departureTime: string) =>
  `${convertIsoUtcToLocalTime(departureTime).slice(0, -6)}Z`;

const upsertNewProjectedTrains = (
  projectedTrains: Map<number, TrainSpaceTimeData>,
  projectedTrainsToUpsert: Record<string, ProjectPathTrainResult>,
  trainSchedulesById: Map<number, TrainScheduleResult>
) => {
  // console.log(
  //   'upsertNewProjectedTrains',
  //   projectedTrains,
  //   projectedTrainsToUpsert,
  //   trainSchedulesById
  // );
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
      departure_time: formatDatetimeForSpaceTimeChart(trainData.departure_time),
    };

    newProjectedTrains.set(trainId, projectedTrain);
  });

  // console.log('upsertNewProjectedTrains', newProjectedTrains);
  return newProjectedTrains;
};

export default upsertNewProjectedTrains;
