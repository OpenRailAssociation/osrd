import type { TrainSpaceTimeData } from 'applications/operationalStudies/types';
import type { ProjectPathTrainResult, TrainScheduleResult } from 'common/api/generatedEditoastApi';

const formatTrainsIntoSpaceTimeData = (
  projectedTrains: Record<string, ProjectPathTrainResult>,
  trainSchedulesById: Record<string, TrainScheduleResult>
) =>
  Object.keys(projectedTrains).reduce((result, trainId) => {
    const currentProjectedTrain = projectedTrains[trainId];
    if (currentProjectedTrain.space_time_curves.length === 0) return result;

    const matchingTrain = trainSchedulesById[trainId];

    const formattedProjectedPathTrainResult = {
      ...currentProjectedTrain,
      id: +trainId,
      trainName: matchingTrain?.train_name || 'Train name not found',
    };
    result.push(formattedProjectedPathTrainResult);
    return result;
  }, [] as TrainSpaceTimeData[]);

export default formatTrainsIntoSpaceTimeData;
