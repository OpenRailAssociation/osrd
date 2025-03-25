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
  formatEditoastTrainIdToOccurrenceId,
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

    const isSelectedTimetableItemIncluded =
      selectedTrainId !== undefined &&
      timetableItemIds.some((timetableItemId) =>
        isTrainSchedule(timetableItemId)
          ? timetableItemId === selectedTrainId
          : selectedTrainId.includes(timetableItemId)
      );

    // if a selected train is given, we use it for the projection
    if (
      selectedTrainId &&
      !currentTrainIdForProjection &&
      isTrainSchedule(selectedTrainId) &&
      timetableItemIds.includes(selectedTrainId)
    ) {
      dispatch(updateTrainIdUsedForProjection(selectedTrainId));
      return;
    }

    // if there is already a projection and the projected train still exists, keep it
    if (currentTrainIdForProjection && isSelectedTimetableItemIncluded) {
      if (isTrainSchedule(timetableItemIds[0])) {
        dispatch(updateSelectedTrainId(timetableItemIds[0]));
      } else {
        const editoastPacedTrainId = formatPacedTrainIdToEditoastTrainId(timetableItemIds[0]);
        const occurrenceIdToSelect = formatEditoastTrainIdToOccurrenceId({
          pacedTrainId: editoastPacedTrainId,
          occurrenceIndex: 0,
        });
        dispatch(updateSelectedTrainId(occurrenceIdToSelect));
      }
      return;
    }

    // by default, use the first valid train
    const firstValidTrain = timetableItemsWithDetails.find((item) => item.isValid);
    if (firstValidTrain) {
      // TODO Paced train : adapt this in issue https://github.com/OpenRailAssociation/osrd/issues/10791
      if (isTrainSchedule(firstValidTrain.id)) {
        dispatch(updateTrainIdUsedForProjection(firstValidTrain.id));
        dispatch(updateSelectedTrainId(firstValidTrain.id));
      }
      if (isPacedTrain(firstValidTrain.id)) {
        const editoastPacedTrainId = formatPacedTrainIdToEditoastTrainId(firstValidTrain.id);
        const occurrenceIdToSelect = formatEditoastTrainIdToOccurrenceId({
          pacedTrainId: editoastPacedTrainId,
          occurrenceIndex: 0,
        });
        dispatch(updateSelectedTrainId(occurrenceIdToSelect));
      }
    }
  }, [timetableItemIds, infra, timetableItemsWithDetails]);
};

export default useAutoUpdateProjection;
