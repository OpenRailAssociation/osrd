import { useMemo } from 'react';

import { useSelector } from 'react-redux';

import type { TrainScheduleResponse } from 'common/api/osrdEditoastApi';
import type { TrainId } from 'reducers/osrdconf/types';
import { getSelectedTrain } from 'reducers/simulationResults/selectors';
import {
  extractEditoastIdFromTrainScheduleId,
  extractTrainScheduleIdFromOccurrenceId,
  isOccurrenceId,
} from 'utils/trainId';

const extractTrainScheduleId = (trainId?: TrainId) => {
  if (!trainId) return undefined;
  return extractEditoastIdFromTrainScheduleId(
    isOccurrenceId(trainId) ? extractTrainScheduleIdFromOccurrenceId(trainId) : trainId
  );
};

const useSelectedTrainSchedule = (
  trainSchedules: TrainScheduleResponse[] | undefined
): TrainScheduleResponse | undefined => {
  const { id: trainId } = useSelector(getSelectedTrain) || {};

  const trainScheduleId = extractTrainScheduleId(trainId);

  return useMemo(
    () => trainSchedules?.find((trainSchedule) => trainSchedule.id === trainScheduleId),
    [trainSchedules, trainScheduleId]
  );
};

export default useSelectedTrainSchedule;
