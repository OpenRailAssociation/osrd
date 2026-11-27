import { useEffect, useMemo, useState } from 'react';

import { skipToken } from '@reduxjs/toolkit/query';
import { useParams } from 'react-router-dom';

import { osrdEditoastApi, type TimetableType } from 'common/api/osrdEditoastApi';
import { useOsrdConfActions } from 'common/osrdContext';
import { updateTrainIdUsedForProjection } from 'reducers/simulationResults';
import { useAppDispatch } from 'store';
import { parseNumber } from 'utils/strings';

import type { Sandbox } from '../types';
import useUrlOrStorageParam from './useUrlOrStorageParam';

type SimulationParams = {
  scenarioId: string;
};

const useScenario = () => {
  const dispatch = useAppDispatch();
  const { updateInfraID } = useOsrdConfActions();

  const { scenarioId: urlScenarioId } = useParams() as SimulationParams;

  // The sandbox is stored per timetable, so that we never use the sandbox of another timetable
  // while the one of the active timetable is loading
  const [sandboxByTimetableId, setSandboxByTimetableId] = useState<
    Partial<Record<number, Sandbox>>
  >({});

  const scenarioId = useMemo(() => parseNumber(urlScenarioId), [urlScenarioId]);

  const { getParamFromUrlOrStorage, setParamsInUrlAndStorage } = useUrlOrStorageParam('timetable');

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

  // The active timetable is the one from the URL, or else from the local storage, or else the first one.
  const savedTimetableId = getParamFromUrlOrStorage('timetable');
  const currentTimetable =
    scenario?.timetable_summaries.find(({ id }) => id.toString() === savedTimetableId) ??
    scenario?.timetable_summaries.at(0);
  const currentSandbox = currentTimetable ? sandboxByTimetableId[currentTimetable.id] : undefined;

  const { currentData: trainScheduleSets } =
    osrdEditoastApi.endpoints.getTimetableByIdTrainScheduleSets.useQuery(
      currentTimetable
        ? {
            id: currentTimetable.id,
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
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [scenario]);

  const currentTimetableId = currentTimetable?.id;
  useEffect(() => {
    if (currentTimetableId !== undefined) {
      void setParamsInUrlAndStorage('timetable', currentTimetableId.toString());
    }
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [currentTimetableId]);

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
    const saveSandbox = (timetableId: number, sandbox: Sandbox) =>
      setSandboxByTimetableId((prev) => {
        const saved = prev[timetableId];
        if (saved?.id === sandbox.id && saved.timetableId === sandbox.timetableId) return prev;
        return { ...prev, [timetableId]: sandbox };
      });

    const checkAndCreateSandbox = async (timetableId: number, timetableType: TimetableType) => {
      const sandboxSet = await postTrainScheduleSets({
        trainScheduleSetForm: {
          name: null, // sandbox never has a name
          description: '',
          published: false,
          timetable_type: timetableType,
        },
      }).unwrap();

      saveSandbox(timetableId, { id: sandboxSet.id, timetableId: sandboxSet.timetable_id });

      await linkTrainscheduleSetToTimetable({
        id: timetableId,
        body: { train_schedule_set_ids: [sandboxSet.id] },
      }).unwrap();
    };

    if (!trainScheduleSets || !currentTimetable) return;

    const existingSandbox = trainScheduleSets.find((tss) => !tss.name);

    if (existingSandbox) {
      saveSandbox(currentTimetable.id, {
        id: existingSandbox.id,
        timetableId: existingSandbox.timetable_id,
      });
      return;
    }

    void checkAndCreateSandbox(currentTimetable.id, currentTimetable.type);
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [trainScheduleSets, currentTimetable?.id, currentTimetable?.type]);

  return {
    scenario,
    timetable: currentTimetable,
    sandbox: currentSandbox,
  };
};

export default useScenario;
