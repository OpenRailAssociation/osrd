import type { TrainSpaceTimeData } from 'applications/operationalStudies/types';
import { type ProjectPathTrainResult } from 'common/api/osrdEditoastApi';
import type { TimetableItemId, TimetableItemWithTimetableId } from 'reducers/osrdconf/types';
import {
  formatPacedTrainIdToOccurrenceId,
  isPacedTrain,
  isPacedTrainResponseWithPacedTrainId,
} from 'utils/trainId';

const upsertNewProjectedTrains = (
  projectedTrains: Map<TimetableItemId, TrainSpaceTimeData>,
  projectedTrainsToUpsert: Map<TimetableItemId, ProjectPathTrainResult>,
  trainSchedulesById: Map<TimetableItemId, TimetableItemWithTimetableId>
) => {
  const newProjectedTrains = new Map(projectedTrains);

  // For each key (train id) in projectPathTrainResult, we either add it or update it in the state
  for (const [trainIdKey, trainData] of projectedTrainsToUpsert) {
    const matchingTrain = trainSchedulesById.get(trainIdKey);
    const projectedTrain = {
      id: isPacedTrain(trainIdKey)
        ? formatPacedTrainIdToOccurrenceId({ pacedTrainId: trainIdKey, occurrenceIndex: 0 })
        : trainIdKey,
      name: matchingTrain?.train_name || 'Train name not found',
      departureTime: new Date(trainData.departure_time),
      spaceTimeCurves: trainData.space_time_curves,
      signalUpdates: trainData.signal_updates,
      paced:
        matchingTrain && isPacedTrainResponseWithPacedTrainId(matchingTrain)
          ? matchingTrain.paced
          : undefined,
    };

    newProjectedTrains.set(trainIdKey, projectedTrain);
  }

  return newProjectedTrains;
};

export default upsertNewProjectedTrains;
