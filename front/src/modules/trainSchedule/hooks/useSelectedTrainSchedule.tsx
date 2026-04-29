import { useMemo } from 'react';

import { useSelector } from 'react-redux';

import type { TrainScheduleResponse } from 'common/api/osrdEditoastApi';
import type { TrainId } from 'reducers/osrdconf/types';
import { getSelectedTrainId } from 'reducers/simulationResults/selectors';
import {
  extractEditoastIdFromPacedTrainId,
  extractPacedTrainIdFromOccurrenceId,
  isOccurrenceId,
} from 'utils/trainId';

const extractTrainScheduleId = (trainId?: TrainId) => {
  if (!trainId) return undefined;
  return extractEditoastIdFromPacedTrainId(
    isOccurrenceId(trainId) ? extractPacedTrainIdFromOccurrenceId(trainId) : trainId
  );
};

const useSelectedTrainSchedule = (
  trainSchedules: TrainScheduleResponse[] | undefined
): TrainScheduleResponse | undefined => {
  const trainId = useSelector(getSelectedTrainId);

  const trainScheduleId = extractTrainScheduleId(trainId);

  return useMemo(
    () => trainSchedules?.find((trainSchedule) => trainSchedule.id === trainScheduleId),
    [trainSchedules, trainScheduleId]
  );
};

export default useSelectedTrainSchedule;
