import { useEffect, useMemo } from 'react';

import { skipToken } from '@reduxjs/toolkit/query';
import { useParams } from 'react-router-dom';

import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import { useOsrdConfActions } from 'common/osrdContext';
import { updateTrainIdUsedForProjection } from 'reducers/simulationResults';
import { useAppDispatch } from 'store';
import { parseNumber } from 'utils/strings';

type SimulationParams = {
  scenarioId: string;
};

const useScenario = () => {
  const dispatch = useAppDispatch();
  const { updateInfraID } = useOsrdConfActions();

  const { scenarioId: urlScenarioId } = useParams() as SimulationParams;

  const scenarioId = useMemo(() => parseNumber(urlScenarioId), [urlScenarioId]);

  const {
    data: scenario,
    isError: isScenarioError,
    error: errorScenario,
  } = osrdEditoastApi.endpoints.getScenariosByScenarioId.useQuery(
    scenarioId
      ? {
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
    if (!scenarioId) {
      throw new Error('Missing scenarioId');
    }
  }, [scenarioId]);

  return { scenario };
};

export default useScenario;
