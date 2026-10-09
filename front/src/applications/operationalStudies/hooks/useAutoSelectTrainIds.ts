import { useCallback, useEffect, useRef, useState } from 'react';

import { useSelector } from 'react-redux';

import { isValidPathfinding } from 'applications/operationalStudies/views/Scenario/components/Timetable/utils';
import type { TrainScheduleWithDetails } from 'modules/trainSchedule/types';
import { updateSelectedTrain, updateTrainIdUsedForProjection } from 'reducers/simulationResults';
import {
  getSelectedTrain,
  getTrainIdUsedForProjection,
} from 'reducers/simulationResults/selectors';
import { useAppDispatch } from 'store';
import {
  formatEditoastIdToTrainScheduleId,
  isOccurrenceId,
  isTrainScheduleId,
  isTrainIdInTimetable,
} from 'utils/trainId';

import useUrlOrStorageParam from './useUrlOrStorageParam';

/**
 * Automatically select the train to be used for the simulation results display and for the projection.
 *
 * This hook is executed if:
 * - the page has just been loaded
 * - a train is deleted, added or modified
 * - new trains have been loaded (if no valid train has been loaded before, selectedTrainId and
 * currentTrainIdForProjection will still be undefined and must be updated)
 */
const useAutoSelectTrainIds = (
  trainSchedulesWithDetails: TrainScheduleWithDetails[] | undefined
) => {
  const dispatch = useAppDispatch();
  const currentTrainIdForProjection = useSelector(getTrainIdUsedForProjection);
  const { id: selectedTrainId } = useSelector(getSelectedTrain) || {};

  const { getParamFromUrlOrStorage, setParamsInUrlAndStorage } = useUrlOrStorageParam(
    'useAutoSelectTrainIds'
  );

  const [parametersLoaded, setParametersLoaded] = useState<boolean>(false);

  // We want to have a default selection only at first load,
  // not when the selected train is deleted
  const initialAutoSelectDoneRef = useRef(false);

  /**
   * Set the selected and projected ids in redux to their values in the URL, or if absent in the local storage
   */
  const setIdsFromUrlOrStorage = useCallback(() => {
    const selectedTrainFromUrl = getParamFromUrlOrStorage('selected_train');
    const projectionFromUrl = getParamFromUrlOrStorage('projection');
    if (
      selectedTrainFromUrl &&
      (isOccurrenceId(selectedTrainFromUrl) || isTrainScheduleId(selectedTrainFromUrl))
    ) {
      dispatch(updateSelectedTrain({ id: selectedTrainFromUrl, by: 'timetable' }));
    }
    if (
      projectionFromUrl &&
      (isOccurrenceId(projectionFromUrl) || isTrainScheduleId(projectionFromUrl))
    ) {
      dispatch(updateTrainIdUsedForProjection(projectionFromUrl));
    }
  }, [getParamFromUrlOrStorage, dispatch]);

  // Update the URL and local storage on redux store change
  useEffect(() => {
    if (parametersLoaded) {
      setParamsInUrlAndStorage('selected_train', selectedTrainId?.toString());
      setParamsInUrlAndStorage('projection', currentTrainIdForProjection?.toString());
    }
  }, [parametersLoaded, selectedTrainId, currentTrainIdForProjection, setParamsInUrlAndStorage]);

  useEffect(() => {
    if (trainSchedulesWithDetails === undefined) {
      return;
    }

    if (trainSchedulesWithDetails.length === 0) {
      initialAutoSelectDoneRef.current = false;
      if (selectedTrainId) dispatch(updateSelectedTrain(undefined));
      if (currentTrainIdForProjection) dispatch(updateTrainIdUsedForProjection(undefined));
      setParametersLoaded(true);
      return;
    }

    if (!parametersLoaded) {
      setIdsFromUrlOrStorage();
      setParametersLoaded(true);
      return;
    }

    const isSelectedTrainIdValid = isTrainIdInTimetable(selectedTrainId, trainSchedulesWithDetails);
    const isProjectedTrainIdValid = isTrainIdInTimetable(
      currentTrainIdForProjection,
      trainSchedulesWithDetails
    );

    // if a selected train schedule is given and is still in the timetable, don't change the selected train
    if (isSelectedTrainIdValid) {
      initialAutoSelectDoneRef.current = true;

      // if no train is used for the projection or the id is invalid, use the selected train
      if (!isProjectedTrainIdValid) {
        dispatch(updateTrainIdUsedForProjection(selectedTrainId));
      }
      return;
    }

    // at this point, the selected train is not in the timetable anymore or is undefined
    if (!selectedTrainId && initialAutoSelectDoneRef.current) {
      return;
    }
    // by default, select the first valid item for the projection
    // if no valid item is found, select item with valid pathfinding
    const firstTrainCanBeUsedForProjection =
      trainSchedulesWithDetails.find((trainSchedule) => trainSchedule.summary?.isValid) ??
      trainSchedulesWithDetails.find(
        (trainSchedule) => trainSchedule.summary && isValidPathfinding(trainSchedule.summary)
      );

    if (firstTrainCanBeUsedForProjection) {
      initialAutoSelectDoneRef.current = true;
      const trainScheduleId = formatEditoastIdToTrainScheduleId(
        firstTrainCanBeUsedForProjection.id
      );
      dispatch(updateSelectedTrain({ id: trainScheduleId, by: 'timetable' }));
      if (!isProjectedTrainIdValid) dispatch(updateTrainIdUsedForProjection(trainScheduleId));
    }
  }, [trainSchedulesWithDetails, setIdsFromUrlOrStorage, parametersLoaded]);
};

export default useAutoSelectTrainIds;
