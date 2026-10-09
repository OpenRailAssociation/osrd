import { useEffect, useMemo, useState } from 'react';

import { skipToken } from '@reduxjs/toolkit/query';
import { useParams } from 'react-router-dom';

import { osrdEditoastApi, type TimetableType } from 'common/api/osrdEditoastApi';
import { useOsrdConfActions } from 'common/osrdContext';
import { updateTrainIdUsedForProjection } from 'reducers/simulationResults';
import { useAppDispatch } from 'store';
import { parseNumber } from 'utils/strings';

import useUrlOrStorageParam from './useUrlOrStorageParam';

type SimulationParams = {
  scenarioId: string;
};

const useScenario = () => {
  const dispatch = useAppDispatch();
  const { updateInfraID } = useOsrdConfActions();

  const { scenarioId: urlScenarioId } = useParams() as SimulationParams;

  const [sandboxId, setSandboxId] = useState<number>();

  const scenarioId = useMemo(() => parseNumber(urlScenarioId), [urlScenarioId]);

  const { setParamsInUrlAndStorage } = useUrlOrStorageParam('timetable');

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

  const { currentData: trainScheduleSets } =
    osrdEditoastApi.endpoints.getTimetableByIdTrainScheduleSets.useQuery(
      scenario
        ? {
            id: scenario.timetable_id,
          }
        : skipToken
    );
  const [postTrainScheduleSets] = osrdEditoastApi.endpoints.postTrainScheduleSets.useMutation();
  const [linkTrainscheduleSetToTimetable] =
    osrdEditoastApi.endpoints.postTimetableByIdTrainScheduleSets.useMutation();

  useEffect(() => {
    if (scenario) {
      dispatch(updateInfraID(scenario.infra_id));
    } else {
      dispatch(updateInfraID(undefined));
      dispatch(updateTrainIdUsedForProjection(undefined));
    }
  }, [scenario]);

  // TODO(#18863): scenarios don't support multiple timetables yet, so this only mirrors
  // the current one into the URL/local storage. Once the backend returns a list, prioritize
  // `getParamFromUrlOrStorage('timetable')` here instead.
  useEffect(() => {
    if (scenario) {
      setParamsInUrlAndStorage('timetable', scenario.timetable_id.toString());
    }
  }, [scenario, setParamsInUrlAndStorage]);

  useEffect(() => {
    if (isScenarioError && errorScenario) throw errorScenario;
  }, [isScenarioError, errorScenario]);

  useEffect(() => {
    if (!scenarioId) {
      throw new Error('Missing scenarioId');
    }
  }, [scenarioId]);

  // Ensure a sandbox train schedule set exists and is linked to the timetable
  useEffect(() => {
    const checkAndCreateSandbox = async (timetableId: number, timetableType: TimetableType) => {
      const sandbox = await postTrainScheduleSets({
        trainScheduleSetForm: {
          name: null, // sandbox never has a name
          description: '',
          published: false,
          timetable_type: timetableType,
        },
      }).unwrap();

      setSandboxId(sandbox.id);

      await linkTrainscheduleSetToTimetable({
        id: timetableId,
        body: { train_schedule_set_ids: [sandbox.id] },
      }).unwrap();
    };

    if (!trainScheduleSets || !scenario) return;

    const sandbox = trainScheduleSets.find((tss) => !tss.name);

    if (sandbox) {
      setSandboxId(sandbox.id);
      return;
    }

    checkAndCreateSandbox(scenario.timetable_id, scenario.timetable_type);
  }, [trainScheduleSets, scenario?.timetable_id, scenario?.timetable_type]);

  return { scenario, sandboxId };
};

export default useScenario;
