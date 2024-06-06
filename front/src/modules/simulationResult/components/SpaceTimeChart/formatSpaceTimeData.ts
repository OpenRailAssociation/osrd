import { omit } from 'lodash';

import type { TrainSpaceTimeData } from 'applications/operationalStudies/types';
import { convertDepartureTimeIntoSec } from 'applications/operationalStudies/utils';
import type { ProjectPathTrainResult, TrainScheduleResult } from 'common/api/generatedEditoastApi';
import { mmToM } from 'utils/physics';
import { ms2sec } from 'utils/timeManipulation';

const formatSpaceTimeData = (
  trainId: string,
  projectPathTrainResult: ProjectPathTrainResult,
  trainName?: string
): TrainSpaceTimeData => {
  const spaceTimeCurves = projectPathTrainResult.space_time_curves.map((spaceTimeCurve) =>
    spaceTimeCurve.times.map((time, index) => ({
      // time refers to the time elapsed since departure so we need to add it to the start time
      time: convertDepartureTimeIntoSec(projectPathTrainResult.departure_time) + ms2sec(time),
      headPosition: mmToM(spaceTimeCurve.positions[index]),
      tailPosition: mmToM(
        spaceTimeCurve.positions[index] - projectPathTrainResult.rolling_stock_length
      ),
    }))
  );

  // We keep snake case here because we don't want to change everything in the d3 helpers
  // since we will remove them soon
  const signal_updates = projectPathTrainResult.signal_updates.map((signalUpdate) => ({
    ...signalUpdate,
    position_end: mmToM(signalUpdate.position_end),
    position_start: mmToM(signalUpdate.position_start),
    time_end:
      convertDepartureTimeIntoSec(projectPathTrainResult.departure_time) +
      ms2sec(signalUpdate.time_end),
    time_start:
      convertDepartureTimeIntoSec(projectPathTrainResult.departure_time) +
      ms2sec(signalUpdate.time_start),
  }));

  return {
    ...omit(projectPathTrainResult, ['space_time_curves', 'signal_updates']),
    spaceTimeCurves,
    signal_updates,
    id: +trainId,
    trainName: trainName || 'Train name not found',
  };
};

const formatTrainsIntoSpaceTimeData = (
  projectedTrains: Record<string, ProjectPathTrainResult>,
  trainSchedulesById: Record<string, TrainScheduleResult>
) =>
  Object.keys(projectedTrains).reduce((result, trainId) => {
    const currentProjectedTrain = projectedTrains[trainId];

    const matchingTrain = trainSchedulesById[trainId];

    const formattedProjectedPathTrainResult = formatSpaceTimeData(
      trainId,
      currentProjectedTrain,
      matchingTrain?.train_name
    );
    result.push(formattedProjectedPathTrainResult);
    return result;
  }, [] as TrainSpaceTimeData[]);

export default formatTrainsIntoSpaceTimeData;
