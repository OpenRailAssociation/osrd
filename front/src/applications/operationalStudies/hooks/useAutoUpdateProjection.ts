import { useEffect } from 'react';

import { useSelector } from 'react-redux';

import type { InfraWithState } from 'common/api/osrdEditoastApi';
import type { TimetableItemWithDetails } from 'modules/trainschedule/components/Timetable/types';
import { updateSelectedTrainId, updateTrainIdUsedForProjection } from 'reducers/simulationResults';
import {
  getSelectedTrainId,
  getTrainIdUsedForProjection,
} from 'reducers/simulationResults/selectors';
import { useAppDispatch } from 'store';
import { formatEditoastTrainIdToTrainScheduleId, isTrainSchedule } from 'utils/trainId';

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
  editoastTrainIds: number[],
  timetableItemsWithDetails: TimetableItemWithDetails[]
) => {
  const dispatch = useAppDispatch();
  const currentTrainIdForProjection = useSelector(getTrainIdUsedForProjection);
  const selectedTrainId = useSelector(getSelectedTrainId);

  const formattedTrainIds = editoastTrainIds.map((editoastTrainId) =>
    formatEditoastTrainIdToTrainScheduleId(editoastTrainId)
  );

  useEffect(() => {
    if (infra.state !== 'CACHED' || editoastTrainIds.length === 0) {
      if (selectedTrainId) dispatch(updateSelectedTrainId(undefined));
      if (currentTrainIdForProjection) dispatch(updateTrainIdUsedForProjection(undefined));
      return;
    }

    // if a selected train is given, we use it for the projection
    if (
      selectedTrainId &&
      isTrainSchedule(selectedTrainId) &&
      !currentTrainIdForProjection &&
      formattedTrainIds.includes(selectedTrainId)
    ) {
      dispatch(updateTrainIdUsedForProjection(selectedTrainId));
      return;
    }

    // if there is already a projection and the projected train still exists, keep it
    if (
      currentTrainIdForProjection &&
      isTrainSchedule(currentTrainIdForProjection) &&
      formattedTrainIds.includes(currentTrainIdForProjection)
    ) {
      if (!selectedTrainId) dispatch(updateSelectedTrainId(formattedTrainIds[0]));
      return;
    }

    // by default, use the first valid train
    const firstValidTrain = timetableItemsWithDetails.find(
      (train) => train.isValid && isTrainSchedule(train.id)
    );
    if (firstValidTrain && isTrainSchedule(firstValidTrain.id)) {
      dispatch(updateTrainIdUsedForProjection(firstValidTrain.id));
      dispatch(updateSelectedTrainId(firstValidTrain.id));
    }
  }, [editoastTrainIds, infra, timetableItemsWithDetails]);
};

export default useAutoUpdateProjection;
