import { useMemo } from 'react';

import { skipToken } from '@reduxjs/toolkit/query';

import { osrdEditoastApi, type TrainScheduleResponse } from 'common/api/osrdEditoastApi';
import type { TrainScheduleWithPathOps } from 'reducers/osrdconf/types';

import { addPathOpsToTrainSchedules, getUniqueOpRefsFromTrainSchedules } from '../utils';

const useTrainSchedulesWithPathOps = (
  infraId: number,
  trainSchedules: TrainScheduleResponse[] | undefined
): TrainScheduleWithPathOps[] => {
  // Extract all unique PathItemLocation from trainSchedules.path
  const trainScheduleOpRefs = useMemo(
    () => getUniqueOpRefsFromTrainSchedules(trainSchedules ?? []),
    [trainSchedules]
  );

  const { currentData: timetableOperationalPoints, isSuccess } =
    osrdEditoastApi.endpoints.matchAllOperationalPoints.useQuery(
      trainScheduleOpRefs.length > 0 ? { infraId, opRefs: trainScheduleOpRefs } : skipToken
    );

  return useMemo(() => {
    if (!trainSchedules || (!isSuccess && trainScheduleOpRefs.length !== 0)) {
      return [];
    }

    return addPathOpsToTrainSchedules(
      trainSchedules,
      trainScheduleOpRefs,
      timetableOperationalPoints ?? []
    );
  }, [trainSchedules, timetableOperationalPoints, trainScheduleOpRefs, isSuccess]);
};

export default useTrainSchedulesWithPathOps;
