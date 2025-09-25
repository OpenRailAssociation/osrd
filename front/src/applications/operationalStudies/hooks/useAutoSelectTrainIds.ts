import { useCallback, useEffect, useMemo, useState } from 'react';

import { useSelector } from 'react-redux';
import { useLocation, useNavigate, useParams } from 'react-router-dom';

import { isValidPathfinding } from 'applications/operationalStudies/views/Scenario/components/Timetable/utils';
import type { TimetableItemWithDetails } from 'modules/timetableItem/types';
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
  isOccurrenceId,
  isPacedTrainId,
  isTrainScheduleId,
} from 'utils/trainId';

type SimulationParams = {
  projectId: string;
  studyId: string;
  scenarioId: string;
};

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
  timetableItemIds: TimetableItemId[] | undefined,
  timetableItemsWithDetails: TimetableItemWithDetails[]
) => {
  const dispatch = useAppDispatch();
  const currentTrainIdForProjection = useSelector(getTrainIdUsedForProjection);
  const selectedTrainId = useSelector(getSelectedTrainId);

  const location = useLocation();
  const navigate = useNavigate();
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);

  const {
    projectId: urlProjectId,
    studyId: urlStudyId,
    scenarioId: urlScenarioId,
  } = useParams() as SimulationParams;
  const localKey = `useAutoSelectTrainIds_project${urlProjectId}_study${urlStudyId}_scenario${urlScenarioId}`;

  const [parametersLoaded, setParametersLoaded] = useState<boolean>(false);

  /**
   * Get a parameter from the URL, or if absent from local storage
   */
  const getParamFromUrlOrStorage = useCallback(
    (paramName: string) =>
      searchParams.get(paramName) || localStorage.getItem(`${localKey}_${paramName}`) || undefined,
    [localKey, searchParams]
  );

  /**
   * Set a parameter in the URL and in the local storage.
   * If the parameter value given is undefined, remove the parameter from the URL and local storage instead.
   */
  const setParamsInUrlAndStorage = useCallback(
    (paramName: string, paramValue: string | undefined) => {
      if (paramValue === undefined) {
        searchParams.delete(paramName);
        localStorage.removeItem(`${localKey}_${paramName}`);
      } else {
        searchParams.set(paramName, paramValue);
        localStorage.setItem(`${localKey}_${paramName}`, paramValue);
      }
      navigate(`${location.pathname}?${searchParams.toString()}`, { replace: true });
    },
    [localKey, searchParams, location.pathname, navigate]
  );

  /**
   * Set the selected and projected ids in redux to their values in the URL, or if absent in the local storage
   */
  const setIdsFromUrlOrStorage = useCallback(() => {
    const selectedTrainFromUrl = getParamFromUrlOrStorage('selected_train');
    const projectionFromUrl = getParamFromUrlOrStorage('projection');
    if (
      selectedTrainFromUrl &&
      (isTrainScheduleId(selectedTrainFromUrl) || isOccurrenceId(selectedTrainFromUrl))
    ) {
      dispatch(updateSelectedTrainId(selectedTrainFromUrl));
    }
    if (
      projectionFromUrl &&
      (isTrainScheduleId(projectionFromUrl) || isPacedTrainId(projectionFromUrl))
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
    if (timetableItemIds === undefined) {
      return;
    }

    if (timetableItemIds.length === 0) {
      if (selectedTrainId) dispatch(updateSelectedTrainId(undefined));
      if (currentTrainIdForProjection) dispatch(updateTrainIdUsedForProjection(undefined));
      setParametersLoaded(true);
      return;
    }

    if (!parametersLoaded) {
      setIdsFromUrlOrStorage();
      setParametersLoaded(true);
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
    // by default, select the first valid item for the projection
    // if no valid item is found, select item with valid pathfinding
    const firstTrainCanBeUsedForProjection =
      timetableItemsWithDetails.find((item) => item.summary?.isValid) ??
      timetableItemsWithDetails.find((item) => item.summary && isValidPathfinding(item.summary));

    if (firstTrainCanBeUsedForProjection) {
      dispatch(updateTrainIdUsedForProjection(firstTrainCanBeUsedForProjection.id));
      const newTrainIdToSelect = isTrainScheduleId(firstTrainCanBeUsedForProjection.id)
        ? firstTrainCanBeUsedForProjection.id
        : formatPacedTrainIdToIndexedOccurrenceId(firstTrainCanBeUsedForProjection.id, 0);
      dispatch(updateSelectedTrainId(newTrainIdToSelect));
    }
  }, [timetableItemIds, timetableItemsWithDetails, setIdsFromUrlOrStorage, parametersLoaded]);
};

export default useAutoSelectTrainIds;
