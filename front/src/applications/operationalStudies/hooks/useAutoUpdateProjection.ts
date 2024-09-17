import { useEffect } from 'react';

import { useSelector } from 'react-redux';

import type { InfraWithState } from 'common/api/osrdEditoastApi';
import type { TrainScheduleWithDetails } from 'modules/trainschedule/components/Timetable/types';
import { updateSelectedTrainId, updateTrainIdUsedForProjection } from 'reducers/simulationResults';
import {
  getSelectedTrainId,
  getTrainIdUsedForProjection,
} from 'reducers/simulationResults/selectors';
import { useAppDispatch } from 'store';

/**
 * Automatically select the train to be used for the simulation results display and for the projection.
 *
 * This hook is executed if:
 * - the infrastructure has just been loaded
 * - a train is deleted, added or modified
 * - new trains have been loaded (if no valid train has been loaded before, selectedTrainId and
 * currentTrainIdForProjection will still be undefined and must be updated)
 */
const useAutoUpdateProjection = (
  infra: InfraWithState,
  trainIds: number[],
  trainScheduleSummaries: TrainScheduleWithDetails[]
) => {
  const dispatch = useAppDispatch();
  const currentTrainIdForProjection = useSelector(getTrainIdUsedForProjection);
  const selectedTrainId = useSelector(getSelectedTrainId);

  useEffect(() => {
    if (infra.state !== 'CACHED' || trainIds.length === 0) {
      if (selectedTrainId) dispatch(updateSelectedTrainId(undefined));
      if (currentTrainIdForProjection) dispatch(updateTrainIdUsedForProjection(undefined));
      return;
    }

    // if a selected train is given, we use it for the projection
    if (selectedTrainId && !currentTrainIdForProjection && trainIds.includes(selectedTrainId)) {
      dispatch(updateTrainIdUsedForProjection(selectedTrainId));
      return;
    }

    // if there is already a projection and the projected train still exists, keep it
    if (currentTrainIdForProjection && trainIds.includes(currentTrainIdForProjection)) {
      if (!selectedTrainId) dispatch(updateSelectedTrainId(trainIds[0]));
      return;
    }

    // by default, use the first valid train
    const firstValidTrain = trainScheduleSummaries.find((train) => train.isValid);
    if (firstValidTrain) {
      dispatch(updateTrainIdUsedForProjection(firstValidTrain.id));
      dispatch(updateSelectedTrainId(firstValidTrain.id));
    }
  }, [trainIds, infra, trainScheduleSummaries]);
};

export default useAutoUpdateProjection;
