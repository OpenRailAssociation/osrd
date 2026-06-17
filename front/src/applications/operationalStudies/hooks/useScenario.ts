import { useEffect, useMemo, useState } from 'react';

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

  const [sandboxId, setSandboxId] = useState<number>();

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
    const checkAndCreateSandbox = async (timetableId: number) => {
      const sandbox = await postTrainScheduleSets({
        trainScheduleSetForm: {
          name: null, // sandbox never has a name
          description: '',
          published: false,
          timetable_type: 'CALENDAR',
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

    checkAndCreateSandbox(scenario.timetable_id);
  }, [trainScheduleSets, scenario?.timetable_id]);

  return { scenario, sandboxId };
};

export default useScenario;
