/* eslint-disable @typescript-eslint/no-non-null-asserted-optional-chain */
import { useCallback, useEffect, useMemo, useState } from 'react';

import { keyBy, sortBy } from 'lodash';
import { useSelector } from 'react-redux';

import { osrdEditoastApi, type TrainScheduleResult } from 'common/api/osrdEditoastApi';
import useInfraStatus from 'modules/pathfinding/hooks/useInfraStatus';
import { setFailure } from 'reducers/main';
import {
  updateSelectedTrainId,
  updateTrainIdUsedForProjection,
} from 'reducers/osrdsimulation/actions';
import { getSelectedTrainId, getTrainIdUsedForProjection } from 'reducers/osrdsimulation/selectors';
import { useAppDispatch } from 'store';
import { castErrorToFailure } from 'utils/error';
import { mapBy } from 'utils/types';

import useLazyLoadTrains from './useLazyLoadTrains';
import useScenario from './useScenario';
import useSimulationResults from './useSimulationResults';
import selectTrainAndPathForProjection from '../helpers/selectTrainAndPathForProjection';

const useScenarioData = () => {
  const dispatch = useAppDispatch();
  const trainIdUsedForProjection = useSelector(getTrainIdUsedForProjection);
  const selectedTrainId = useSelector(getSelectedTrainId);

  const [trainSchedules, setTrainSchedules] = useState<TrainScheduleResult[]>();
  const [trainIdsToFetch, setTrainIdsToFetch] = useState<number[]>();

  const scenario = useScenario();

  const { infra, isInfraLoaded, reloadCount } = useInfraStatus();

  const { data: timetable } = osrdEditoastApi.endpoints.getV2TimetableById.useQuery(
    { id: scenario?.timetable_id! },
    {
      skip: !scenario,
    }
  );

  const { data: rawTrainSchedules, error: fetchTrainSchedulesError } =
    osrdEditoastApi.endpoints.postV2TrainSchedule.useQuery(
      {
        body: {
          ids: timetable?.train_ids!,
        },
      },
      {
        skip: !timetable || !timetable.train_ids.length,
      }
    );

  const { data: conflicts } = osrdEditoastApi.endpoints.getV2TimetableByIdConflicts.useQuery(
    { id: scenario?.timetable_id!, infraId: scenario?.infra_id! },
    { skip: !scenario }
  );

  const { data: projectionPath } = osrdEditoastApi.endpoints.getV2TrainScheduleByIdPath.useQuery(
    {
      id: trainIdUsedForProjection!,
      infraId: scenario?.infra_id!,
    },
    {
      skip: !scenario || !trainIdUsedForProjection,
    }
  );

  const simulationResults = useSimulationResults();

  const {
    trainScheduleSummariesById,
    projectedTrainsById,
    setTrainScheduleSummariesById,
    setProjectedTrainsById,
  } = useLazyLoadTrains({
    infraId: scenario?.infra_id,
    trainIdsToFetch,
    setTrainIdsToFetch,
    path: projectionPath?.status === 'success' ? projectionPath : undefined,
    trainSchedules,
  });

  const trainScheduleSummaries = useMemo(
    () => sortBy(Array.from(trainScheduleSummariesById.values()), 'startTime'),
    [trainScheduleSummariesById]
  );

  const projectedTrains = useMemo(
    () => Array.from(projectedTrainsById.values()),
    [projectedTrainsById]
  );

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
    if (trainSchedules && infra?.state === 'CACHED' && trainScheduleSummaries.length === 0) {
      const trainIds = trainSchedules.map((trainSchedule) => trainSchedule.id);
      setTrainIdsToFetch(trainIds);
    }
  }, [trainSchedules, infra?.state]);

  useEffect(() => {
    if (fetchTrainSchedulesError) {
      dispatch(setFailure(castErrorToFailure(fetchTrainSchedulesError)));
    }
  }, [fetchTrainSchedulesError]);

  // TODO: refacto selectTrainAndPathForProjection
  useEffect(() => {
    if (trainSchedules && infra?.state === 'CACHED' && trainSchedules.length > 0) {
      selectTrainAndPathForProjection(
        trainSchedules.map((trainSchedule) => trainSchedule.id),
        (id: number) => dispatch(updateSelectedTrainId(id)),
        (id: number) => dispatch(updateTrainIdUsedForProjection(id)),
        trainIdUsedForProjection,
        selectedTrainId
      );
    }
  }, [trainSchedules, infra]);

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

  const removeTrains = (_trainIdsToRemove: number[]) => {
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
  };

  useEffect(() => {
    dispatch(updateTrainIdUsedForProjection(undefined));
    dispatch(updateSelectedTrainId(undefined));
  }, []);

  return scenario && timetable
    ? {
        scenario,
        timetable,
        infraId: scenario.infra_id,
        selectedTrainId,
        infra: { infra, isInfraLoaded, reloadCount },
        trainScheduleSummaries,
        trainSchedules,
        trainIdUsedForProjection,
        projectedTrains,
        simulationResults,
        conflicts,
        removeTrains,
        upsertTrainSchedules,
      }
    : undefined;
};
export default useScenarioData;
