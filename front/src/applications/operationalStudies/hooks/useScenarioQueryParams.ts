import { useEffect, useCallback, useMemo } from 'react';

import { useSelector } from 'react-redux';
import { useLocation, useNavigate, useParams } from 'react-router-dom';

import { updateSelectedTrainId, updateTrainIdUsedForProjection } from 'reducers/simulationResults';
import {
  getSelectedTrainId,
  getTrainIdUsedForProjection,
} from 'reducers/simulationResults/selectors';
import { useAppDispatch } from 'store';

type SimulationParams = {
  projectId: string;
  studyId: string;
  scenarioId: string;
};

const useScenarioQueryParams = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  const {
    projectId: urlProjectId,
    studyId: urlStudyId,
    scenarioId: urlScenarioId,
  } = useParams() as SimulationParams;
  const localKey = `useScenarioQueryParams_project${urlProjectId}_study${urlStudyId}_scenario${urlScenarioId}`;

  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);

  const reduxSelectedTrainId = useSelector(getSelectedTrainId);
  const reduxProjectionTrainId = useSelector(getTrainIdUsedForProjection);

  // Helper function to get a parameter from the URL, or if absent from local storage
  const getParamFromUrlOrStorage = useCallback(
    (paramName: string) =>
      searchParams.get(paramName) || localStorage.getItem(`${localKey}_${paramName}`) || undefined,
    [localKey, searchParams]
  );

  // Helper function to get a parameter from the URL or local storage
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

  // Update the redux store on page load
  useEffect(() => {
    const selectedTrainFromUrl = getParamFromUrlOrStorage('selected_train');
    const projectionFromUrl = getParamFromUrlOrStorage('projection');

    if (selectedTrainFromUrl) {
      dispatch(updateSelectedTrainId(Number(selectedTrainFromUrl)));
    }
    if (projectionFromUrl) {
      dispatch(updateTrainIdUsedForProjection(Number(projectionFromUrl)));
    }
  }, [dispatch, getParamFromUrlOrStorage]);

  // Update the URL and local storage on redux store change
  useEffect(() => {
    if (reduxSelectedTrainId?.toString() !== getParamFromUrlOrStorage('selected_train')) {
      setParamsInUrlAndStorage('selected_train', reduxSelectedTrainId?.toString());
    }
    if (reduxProjectionTrainId?.toString() !== getParamFromUrlOrStorage('projection')) {
      setParamsInUrlAndStorage('projection', reduxProjectionTrainId?.toString());
    }
  }, [
    reduxSelectedTrainId,
    reduxProjectionTrainId,
    setParamsInUrlAndStorage,
    getParamFromUrlOrStorage,
  ]);
};

export default useScenarioQueryParams;
