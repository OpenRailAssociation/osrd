import { useCallback, useEffect, useMemo, useState } from 'react';

import { keyBy, sortBy } from 'lodash';
import { useSelector } from 'react-redux';

import {
  osrdEditoastApi,
  type InfraWithState,
  type ScenarioResponse,
  type TimetableDetailedResult,
  type TrainScheduleResult,
} from 'common/api/osrdEditoastApi';
import { setFailure } from 'reducers/main';
import { updateSelectedTrainId, updateTrainIdUsedForProjection } from 'reducers/simulationResults';
import {
  getSelectedTrainId,
  getTrainIdUsedForProjection,
} from 'reducers/simulationResults/selectors';
import { useAppDispatch } from 'store';
import { castErrorToFailure } from 'utils/error';
import { mapBy } from 'utils/types';

import useAutoUpdateProjection from './useAutoUpdateProjection';
import useLazyLoadTrains from './useLazyLoadTrains';
import usePathProjection from './usePathProjection';
import useSimulationResults from './useSimulationResults';

const useScenarioData = (
  scenario: ScenarioResponse,
  timetable: TimetableDetailedResult,
  infra: InfraWithState
) => {
  const dispatch = useAppDispatch();
  const trainIdUsedForProjection = useSelector(getTrainIdUsedForProjection);
  const selectedTrainId = useSelector(getSelectedTrainId);

  const [trainSchedules, setTrainSchedules] = useState<TrainScheduleResult[]>();
  const [trainIdsToFetch, setTrainIdsToFetch] = useState<number[]>();

  const { data: rawTrainSchedules, error: fetchTrainSchedulesError } =
    osrdEditoastApi.endpoints.postTrainSchedule.useQuery({
      body: {
        ids: timetable.train_ids,
      },
    });

  const projectionPath = usePathProjection(infra);

  const simulationResults = useSimulationResults();

  const {
    trainScheduleSummariesById,
    projectedTrainsById,
    setTrainScheduleSummariesById,
    setProjectedTrainsById,
    allTrainsLoaded,
    allTrainsProjected,
  } = useLazyLoadTrains({
    infraId: scenario.infra_id,
    trainIdsToFetch,
    setTrainIdsToFetch,
    path: projectionPath?.path,
    trainSchedules,
  });

  const { data: conflicts } = osrdEditoastApi.endpoints.getTimetableByIdConflicts.useQuery(
    {
      id: scenario.timetable_id,
      infraId: scenario.infra_id,
    },
    { skip: !allTrainsLoaded }
  );

  const trainScheduleSummaries = useMemo(
    () => sortBy(Array.from(trainScheduleSummariesById.values()), 'startTime'),
    [trainScheduleSummariesById]
  );

  const projectedTrains = useMemo(
    () => Array.from(projectedTrainsById.values()),
    [projectedTrainsById]
  );

  const trainScheduleUsedForProjection = useMemo(
    () => trainSchedules?.find((trainSchedule) => trainSchedule.id === trainIdUsedForProjection),
    [trainIdUsedForProjection, trainSchedules]
  );

  useAutoUpdateProjection(infra, timetable.train_ids, trainScheduleSummaries);

  useEffect(() => {
    if (!rawTrainSchedules) {
      setTrainSchedules(undefined);
    } else {
      const sortedTrainSchedules = sortBy(rawTrainSchedules, 'start_time');
      setTrainSchedules(sortedTrainSchedules);
    }
  }, [rawTrainSchedules]);

  // first load of the trainScheduleSummaries
  useEffect(() => {
    if (trainSchedules && infra.state === 'CACHED' && trainScheduleSummaries.length === 0) {
      const trainIds = trainSchedules.map((trainSchedule) => trainSchedule.id);
      setTrainIdsToFetch(trainIds);
    }
  }, [trainSchedules, infra.state]);

  useEffect(() => {
    if (fetchTrainSchedulesError) {
      dispatch(setFailure(castErrorToFailure(fetchTrainSchedulesError)));
    }
  }, [fetchTrainSchedulesError]);

  const upsertTrainSchedules = useCallback(
    (trainSchedulesToUpsert: TrainScheduleResult[]) => {
      setTrainSchedules((prev) => {
        const newTrainSchedulesById = {
          ...keyBy(prev, 'id'),
          ...keyBy(trainSchedulesToUpsert, 'id'),
        };
        const newTrainSchedules = sortBy(Object.values(newTrainSchedulesById), 'start_time');
        return newTrainSchedules;
      });

      setProjectedTrainsById((prev) => {
        const newProjectedTrainsById = new Map(prev);
        trainSchedulesToUpsert.forEach((trainSchedule) => {
          newProjectedTrainsById.delete(trainSchedule.id);
        });
        return newProjectedTrainsById;
      });

      const sortedTrainSchedulesToUpsert = sortBy(trainSchedulesToUpsert, 'start_time');
      setTrainIdsToFetch(sortedTrainSchedulesToUpsert.map((trainSchedule) => trainSchedule.id));
    },
    [trainSchedules]
  );

  const removeTrains = useCallback((_trainIdsToRemove: number[]) => {
    setTrainSchedules((prev) => {
      const trainSchedulesById = mapBy(prev, 'id');
      _trainIdsToRemove.forEach((trainId) => {
        trainSchedulesById.delete(trainId);
      });
      return Array.from(trainSchedulesById.values());
    });

    setTrainScheduleSummariesById((prev) => {
      const newTrainScheduleSummariesById = new Map(prev);
      _trainIdsToRemove.forEach((trainId) => {
        newTrainScheduleSummariesById.delete(trainId);
      });
      return newTrainScheduleSummariesById;
    });

    setProjectedTrainsById((prev) => {
      const newProjectedTrainsById = new Map(prev);
      _trainIdsToRemove.forEach((trainId) => {
        newProjectedTrainsById.delete(trainId);
      });
      return newProjectedTrainsById;
    });
  }, []);

  useEffect(() => {
    dispatch(updateTrainIdUsedForProjection(undefined));
    dispatch(updateSelectedTrainId(undefined));
    return () => {
      dispatch(updateTrainIdUsedForProjection(undefined));
      dispatch(updateSelectedTrainId(undefined));
    };
  }, []);

  return {
    selectedTrainId,
    trainScheduleSummaries,
    trainSchedules,
    projectionData:
      trainScheduleUsedForProjection && projectionPath
        ? {
            trainSchedule: trainScheduleUsedForProjection,
            ...projectionPath,
            projectedTrains,
            allTrainsProjected,
          }
        : undefined,
    simulationResults,
    conflicts,
    removeTrains,
    upsertTrainSchedules,
  };
};

export default useScenarioData;
