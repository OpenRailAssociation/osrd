import { useEffect, useMemo } from 'react';

import { skipToken } from '@reduxjs/toolkit/query';
import { useParams } from 'react-router-dom';

import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import { useOsrdConfActions } from 'common/osrdContext';
import { updateTrainIdUsedForProjection } from 'reducers/simulationResults';
import { useAppDispatch } from 'store';
import { parseNumber } from 'utils/strings';

type SimulationParams = {
  projectId: string;
  studyId: string;
  scenarioId: string;
};

const useScenario = () => {
  const dispatch = useAppDispatch();
  const { updateInfraID } = useOsrdConfActions();

  const {
    projectId: urlProjectId,
    studyId: urlStudyId,
    scenarioId: urlScenarioId,
  } = useParams() as SimulationParams;

  const { projectId, studyId, scenarioId } = useMemo(
    () => ({
      projectId: parseNumber(urlProjectId),
      studyId: parseNumber(urlStudyId),
      scenarioId: parseNumber(urlScenarioId),
    }),
    [urlStudyId, urlProjectId, urlScenarioId]
  );

  const {
    data: scenario,
    isError: isScenarioError,
    error: errorScenario,
  } = osrdEditoastApi.endpoints.getProjectsByProjectIdStudiesAndStudyIdScenariosScenarioId.useQuery(
    projectId && studyId && scenarioId
      ? {
          projectId: projectId,
          studyId: studyId,
          scenarioId: scenarioId,
        }
      : skipToken
  );

  useEffect(() => {
    if (scenario) {
      dispatch(updateInfraID(scenario.infra_id));
    } else {
      dispatch(updateInfraID(undefined));
      dispatch(updateTrainIdUsedForProjection(undefined));
    }
  }, [scenario]);

  useEffect(() => {
    if (isScenarioError && errorScenario) throw errorScenario;
  }, [isScenarioError, errorScenario]);

  useEffect(() => {
    if (!projectId || !studyId || !scenarioId) {
      throw new Error('Missing projectId, studyId or scenarioId');
    }
  }, [projectId, studyId, scenarioId]);

  return { scenario };
};

export default useScenario;
