import { useEffect } from 'react';

import { useSelector } from 'react-redux';

import type { InfraWithState } from 'common/api/osrdEditoastApi';
import type { TimetableItemWithDetails } from 'modules/timetableItem/components/Timetable/types';
import type { TimetableItemId } from 'reducers/osrdconf/types';
import { updateSelectedTrainId, updateTrainIdUsedForProjection } from 'reducers/simulationResults';
import {
  getSelectedTrainId,
  getTrainIdUsedForProjection,
} from 'reducers/simulationResults/selectors';
import { useAppDispatch } from 'store';
import {
  extractPacedTrainIdFromOccurrenceId,
  formatPacedTrainIdToIndexedOccurrenceId,
  isTrainScheduleId,
} from 'utils/trainId';

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
  timetableItemIds: TimetableItemId[],
  timetableItemsWithDetails: TimetableItemWithDetails[]
) => {
  const dispatch = useAppDispatch();
  const currentTrainIdForProjection = useSelector(getTrainIdUsedForProjection);
  const selectedTrainId = useSelector(getSelectedTrainId);

  useEffect(() => {
    if (infra.state !== 'CACHED' || timetableItemIds.length === 0) {
      if (selectedTrainId) dispatch(updateSelectedTrainId(undefined));
      if (currentTrainIdForProjection) dispatch(updateTrainIdUsedForProjection(undefined));
      return;
    }

    let timetableItemId: TimetableItemId | undefined;
    if (selectedTrainId) {
      timetableItemId = isTrainScheduleId(selectedTrainId)
        ? selectedTrainId
        : extractPacedTrainIdFromOccurrenceId(selectedTrainId);
    }

    const isSelectedTimetableItemIncluded =
      !!timetableItemId && timetableItemIds.some((id) => id === timetableItemId);

    // if a selected timetable item is given and is still in the timetable, don't change the selected train
    if (timetableItemId && isSelectedTimetableItemIncluded) {
      // if no train is used for the projection, use the selected train
      if (!currentTrainIdForProjection) {
        dispatch(updateTrainIdUsedForProjection(timetableItemId));
      }
      return;
    }

    // at this point, the selected train is not in the timetable anymore or is undefined
    // by default, select the first valid train
    const firstValidTrain = timetableItemsWithDetails.find((item) => item.isValid);
    if (firstValidTrain) {
      dispatch(updateTrainIdUsedForProjection(firstValidTrain.id));
      const newTrainIdToSelect = isTrainScheduleId(firstValidTrain.id)
        ? firstValidTrain.id
        : formatPacedTrainIdToIndexedOccurrenceId(firstValidTrain.id, 0);
      dispatch(updateSelectedTrainId(newTrainIdToSelect));
    }
  }, [timetableItemIds, infra, timetableItemsWithDetails]);
};

export default useAutoUpdateProjection;
