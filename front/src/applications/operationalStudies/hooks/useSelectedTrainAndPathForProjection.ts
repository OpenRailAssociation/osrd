import type { InfraWithState } from 'common/api/osrdEditoastApi';
import { useEffect } from 'react';
import { useAppDispatch } from 'store';

import {
  updateSelectedTrainId,
  updateTrainIdUsedForProjection,
} from 'reducers/osrdsimulation/actions';
import { useSelector } from 'react-redux';
import { getSelectedTrainId, getTrainIdUsedForProjection } from 'reducers/osrdsimulation/selectors';
import type { TrainScheduleWithDetails } from 'modules/trainschedule/components/Timetable/types';

const useSelectedTrainAndPathForProjection = (
  infra: InfraWithState,
  trainIds: number[],
  trainScheduleSummaries: TrainScheduleWithDetails[]
) => {
  const dispatch = useAppDispatch();
  const currentProjection = useSelector(getTrainIdUsedForProjection);
  const selectedTrainId = useSelector(getSelectedTrainId);

  useEffect(() => {
    if (infra.state === 'CACHED' && trainIds.length > 0 && !currentProjection) {

      // if a selected train is given, we use it for the projection
      if (selectedTrainId && !currentProjection && trainIds.includes(selectedTrainId)) {
        dispatch(updateTrainIdUsedForProjection(selectedTrainId));
        return;
      }

      // if there is already a projection and the projected train still exists, keep it
      if (currentProjection && trainIds.includes(currentProjection)) {
        if (!selectedTrainId) dispatch(updateSelectedTrainId(trainIds[0]));
        return;
      }

      // by default, use the first valid train
      const firstValidTrain = trainScheduleSummaries.find((train) => train.isValid);
      if (firstValidTrain) {
        dispatch(updateTrainIdUsedForProjection(firstValidTrain.id));
        dispatch(updateSelectedTrainId(firstValidTrain.id));
      }
    }
  }, [trainIds, infra && trainScheduleSummaries]);
};

export default useSelectedTrainAndPathForProjection;
