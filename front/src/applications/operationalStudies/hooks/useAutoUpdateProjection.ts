import { useEffect } from 'react';

import { useSelector } from 'react-redux';

import type { InfraWithState } from 'common/api/osrdEditoastApi';
import type { TimetableItemWithDetails } from 'modules/trainschedule/components/Timetable/types';
import type { TimetableItemId } from 'reducers/osrdconf/types';
import { updateSelectedTrainId, updateTrainIdUsedForProjection } from 'reducers/simulationResults';
import {
  getSelectedTrainId,
  getTrainIdUsedForProjection,
} from 'reducers/simulationResults/selectors';
import { useAppDispatch } from 'store';
import {
  extractPacedTrainIdFromOccurrenceId,
  formatEditoastTrainIdToIndexedOccurrenceId,
  formatPacedTrainIdToEditoastTrainId,
  isPacedTrain,
  isTrainSchedule,
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
      timetableItemId = isTrainSchedule(selectedTrainId)
        ? selectedTrainId
        : extractPacedTrainIdFromOccurrenceId(selectedTrainId);
    }

    const isSelectedTimetableItemIncluded =
      !!timetableItemId && timetableItemIds.some((id) => id === timetableItemId);

    // if a selected timetable item is given and is still in the timetable, don't change the selected train
    if (timetableItemId && isSelectedTimetableItemIncluded) {
      // if no train is used for the projection, use the selected train (only if it is a trainSchedule for now)
      // TODO Paced train : adapt this in issue https://github.com/OpenRailAssociation/osrd/issues/10791
      if (!currentTrainIdForProjection && isTrainSchedule(timetableItemId)) {
        dispatch(updateTrainIdUsedForProjection(timetableItemId));
      }
      return;
    }

    // at this point, the selected train is not in the timetable anymore or is undefined
    // by default, select the first valid train
    const firstValidTrain = timetableItemsWithDetails.find((item) => item.isValid);
    if (firstValidTrain) {
      // TODO Paced train : adapt this in issue https://github.com/OpenRailAssociation/osrd/issues/10791
      if (isTrainSchedule(firstValidTrain.id)) {
        dispatch(updateTrainIdUsedForProjection(firstValidTrain.id));
        dispatch(updateSelectedTrainId(firstValidTrain.id));
      }
      if (isPacedTrain(firstValidTrain.id)) {
        const editoastPacedTrainId = formatPacedTrainIdToEditoastTrainId(firstValidTrain.id);
        const occurrenceIdToSelect = formatEditoastTrainIdToIndexedOccurrenceId({
          pacedTrainId: editoastPacedTrainId,
          occurrenceIndex: 0,
        });
        dispatch(updateSelectedTrainId(occurrenceIdToSelect));
      }
    }
  }, [timetableItemIds, infra, timetableItemsWithDetails]);
};

export default useAutoUpdateProjection;
