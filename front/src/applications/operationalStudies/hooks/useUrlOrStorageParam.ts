import { useCallback, useMemo } from 'react';

import { useLocation, useNavigate, useParams } from 'react-router-dom';

type SimulationParams = {
  projectId: string;
  studyId: string;
  scenarioId: string;
};

/**
 * Generic helpers to read a URL query param (falling back to a per-scenario localStorage
 * mirror when absent from the URL) and to keep both in sync when it changes.
 *
 * `keyPrefix` namespaces the localStorage keys so several callers can each remember their
 * own params without colliding (and so existing stored values keep matching their original
 * key after a refactor).
 */
const useUrlOrStorageParam = (keyPrefix: string) => {
  const location = useLocation();
  const navigate = useNavigate();
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);

  const {
    projectId: urlProjectId,
    studyId: urlStudyId,
    scenarioId: urlScenarioId,
  } = useParams() as SimulationParams;
  const localKey = `${keyPrefix}_project${urlProjectId}_study${urlStudyId}_scenario${urlScenarioId}`;

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

  return { getParamFromUrlOrStorage, setParamsInUrlAndStorage };
};

export default useUrlOrStorageParam;
