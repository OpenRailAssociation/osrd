import { useCallback, useEffect, useMemo, useState } from 'react';

import { keyBy, sortBy } from 'lodash';
import { useSelector } from 'react-redux';

import {
  osrdEditoastApi,
  type InfraWithState,
  type ScenarioResponse,
  type SimulationSummaryResult,
} from 'common/api/osrdEditoastApi';
import { useOsrdConfSelectors } from 'common/osrdContext';
import useLazyProjectTrains from 'modules/simulationResult/components/SpaceTimeChart/useLazyProjectTrains';
import type {
  TimetableItemId,
  TrainId,
  TrainScheduleId,
  TrainScheduleResultWithTrainId,
} from 'reducers/osrdconf/types';
import { getTrainIdUsedForProjection } from 'reducers/simulationResults/selectors';
import {
  formatEditoastTrainIdToTrainScheduleId,
  formatTrainScheduleIdToEditoastTrainId,
} from 'utils/trainId';
import { mapBy } from 'utils/types';

import useAutoUpdateProjection from './useAutoUpdateProjection';
import useLazyLoadTrains from './useLazyLoadTrains';
import usePathProjection from './usePathProjection';
import formatTrainScheduleSummaries from '../helpers/formatTrainScheduleSummaries';

const useScenarioData = (scenario: ScenarioResponse, infra: InfraWithState) => {
  const { getElectricalProfileSetId } = useOsrdConfSelectors();
  const electricalProfileSetId = useSelector(getElectricalProfileSetId);
  const trainIdUsedForProjection = useSelector(getTrainIdUsedForProjection);

  const [trainSchedules, setTrainSchedules] = useState<TrainScheduleResultWithTrainId[]>();
  const [trainIdsToFetch, setTrainIdsToFetch] = useState<TrainId[]>();
  const [trainIdsToProject, setTrainIdsToProject] = useState<Set<TrainId>>(new Set());

  const [putTrainScheduleById] = osrdEditoastApi.endpoints.putTrainScheduleById.useMutation();
  const [postTrainScheduleSimulationSummary] =
    osrdEditoastApi.endpoints.postTrainScheduleSimulationSummary.useLazyQuery();
  const { data: { results: rollingStocks } = { results: null } } =
    osrdEditoastApi.endpoints.getLightRollingStock.useQuery({ pageSize: 1000 });

  const projectionPath = usePathProjection(infra);

  const { data: trainSchedulesResults = [] } =
    osrdEditoastApi.endpoints.getAllTimetableByIdTrainSchedules.useQuery(
      { timetableId: scenario?.timetable_id },
      {
        skip: !scenario,
      }
    );

  const { trainScheduleSummariesById, setTrainScheduleSummariesById, allTrainsLoaded } =
    useLazyLoadTrains({
      infraId: scenario.infra_id,
      trainIdsToFetch,
      trainSchedules,
      setTrainIdsToProject,
    });

  useEffect(() => {
    if (allTrainsLoaded) {
      setTrainIdsToFetch([]);
    }
  }, [allTrainsLoaded]);

  const { projectedTrainsById, allTrainsProjected, setProjectedTrainsById } = useLazyProjectTrains({
    infraId: scenario.infra_id,
    trainIdsToProject,
    path: projectionPath?.path,
    trainSchedules,
    moreTrainsToCome: !allTrainsLoaded,
    setTrainIdsToProject,
  });

  useEffect(() => {
    if (trainSchedules && projectionPath?.path && allTrainsLoaded) {
      // TODO Paced train : Adapt this to handle paced trains in issue https://github.com/OpenRailAssociation/osrd/issues/10615
      const trainIds = trainSchedules.map((trainSchedule) => trainSchedule.id);
      setTrainIdsToProject(new Set(trainIds));
    }
  }, [projectionPath?.path]);

  const { data: conflicts, refetch: refetchConflicts } =
    osrdEditoastApi.endpoints.getTimetableByIdConflicts.useQuery(
      {
        id: scenario.timetable_id,
        infraId: scenario.infra_id,
      },
      {
        skip: !allTrainsLoaded,
      }
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

  const trainsIds = useMemo(() => trainSchedulesResults.map((t) => t.id), [trainSchedulesResults]);

  // TODO Paced train : Adapt this to accept paced trains in issue https://github.com/OpenRailAssociation/osrd/issues/10613
  useAutoUpdateProjection(infra, trainsIds, trainScheduleSummaries);

  useEffect(() => {
    const formattedRawTrainSchedules: TrainScheduleResultWithTrainId[] = trainSchedulesResults.map(
      (trainSchedule) => ({
        ...trainSchedule,
        id: formatEditoastTrainIdToTrainScheduleId(trainSchedule.id),
      })
    );
    const sortedTrainSchedules = sortBy(formattedRawTrainSchedules, 'start_time');
    setTrainSchedules(sortedTrainSchedules);
  }, [trainSchedulesResults]);

  // first load of the trainScheduleSummaries
  useEffect(() => {
    if (trainSchedules && infra.state === 'CACHED' && trainScheduleSummaries.length === 0) {
      // TODO Paced train : Adapt this to handle paced trains in issue https://github.com/OpenRailAssociation/osrd/issues/10615
      const trainIds = trainSchedules.map((trainSchedule) => trainSchedule.id);
      setTrainIdsToFetch(trainIds);
    }
  }, [trainSchedules, infra.state]);

  const upsertTrainSchedules = useCallback(
    (trainSchedulesToUpsert: TrainScheduleResultWithTrainId[]) => {
      // TODO Paced train : Add another check if the train is a paced train for the add paced train issue : https://github.com/OpenRailAssociation/osrd/issues/10615
      setProjectedTrainsById((prev) => {
        const newProjectedTrainsById = new Map(prev);
        trainSchedulesToUpsert.forEach((trainSchedule) => {
          newProjectedTrainsById.delete(trainSchedule.id);
        });
        return newProjectedTrainsById;
      });

      setTrainSchedules((prev) => {
        const newTrainSchedulesById = {
          ...keyBy(prev, 'id'),
          ...keyBy(trainSchedulesToUpsert, 'id'),
        };
        return sortBy(Object.values(newTrainSchedulesById), 'start_time');
      });

      const sortedTrainSchedulesToUpsert = sortBy(trainSchedulesToUpsert, 'start_time');
      setTrainIdsToFetch(sortedTrainSchedulesToUpsert.map((trainSchedule) => trainSchedule.id));
    },
    [trainSchedules]
  );

  const removeTrains = useCallback((_trainIdsToRemove: TimetableItemId[]) => {
    // TODO Paced train : Add another check if the train is a paced train for the delete paced train issue : https://github.com/OpenRailAssociation/osrd/issues/10615

    setTrainSchedules((prev) => {
      const trainSchedulesById = mapBy(prev, 'id');
      _trainIdsToRemove.forEach((trainId) => {
        trainSchedulesById.delete(trainId as TrainScheduleId);
      });
      return Array.from(trainSchedulesById.values());
    });

    setTrainScheduleSummariesById((prev) => {
      const newTrainScheduleSummariesById = new Map(prev);
      _trainIdsToRemove.forEach((trainId) => {
        // TODO Paced train : Add another check if the train is a paced train for the delete paced train issue : https://github.com/OpenRailAssociation/osrd/issues/10615
        newTrainScheduleSummariesById.delete(trainId as TrainScheduleId);
      });
      return newTrainScheduleSummariesById;
    });

    setProjectedTrainsById((prev) => {
      const newProjectedTrainsById = new Map(prev);
      _trainIdsToRemove.forEach((trainId) => {
        // TODO Paced train : Add another check if the train is a paced train for the delete paced train issue : https://github.com/OpenRailAssociation/osrd/issues/10615
        newProjectedTrainsById.delete(trainId as TrainScheduleId);
      });
      return newProjectedTrainsById;
    });
  }, []);

  // TODO Paced train : change this function to handle paced trains in the drag issue
  /** Update only depature time of a train */
  const updateTrainDepartureTime = useCallback(
    async (trainId: TrainId, newDeparture: Date) => {
      // TODO Paced train : Add another check if the train is a paced train for the paced train drag issue
      const editoastTrainId = formatTrainScheduleIdToEditoastTrainId(trainId as TrainScheduleId);

      const trainSchedule = trainSchedules?.find((train) => train.id === trainId);

      if (!trainSchedule) {
        throw new Error('Train non trouvé');
      }

      const trainScheduleResult = await putTrainScheduleById({
        id: editoastTrainId,
        trainScheduleForm: {
          ...trainSchedule,
          start_time: newDeparture.toISOString(),
        },
      }).unwrap();

      // TODO Paced train : Add another check if the train is a paced train for the paced train drag issue
      const updatedTrainScheduleResult: TrainScheduleResultWithTrainId = {
        ...trainScheduleResult,
        id: formatEditoastTrainIdToTrainScheduleId(trainScheduleResult.id),
      };

      setProjectedTrainsById((prev) => {
        const newProjectedTrainsById = new Map(prev);
        newProjectedTrainsById.set(updatedTrainScheduleResult.id, {
          ...newProjectedTrainsById.get(updatedTrainScheduleResult.id)!,
          departureTime: newDeparture,
        });
        return newProjectedTrainsById;
      });

      setTrainSchedules((prev) => {
        const newTrainSchedulesById = {
          ...keyBy(prev, 'id'),
          ...keyBy([updatedTrainScheduleResult], 'id'),
        };
        return sortBy(Object.values(newTrainSchedulesById), 'start_time');
      });

      // update its summary
      const rawSummaries = await postTrainScheduleSimulationSummary({
        body: {
          infra_id: scenario.infra_id,
          ids: [editoastTrainId],
          electrical_profile_set_id: electricalProfileSetId,
        },
      }).unwrap();

      // TODO Paced train : Adapt this for the add paced train issue : https://github.com/OpenRailAssociation/osrd/issues/10615
      const formattedRawSummaries: Map<TrainScheduleId, SimulationSummaryResult> = new Map();
      for (const [_editoastTrainId, trainSummary] of Object.entries(rawSummaries)) {
        const formattedTrainId = formatEditoastTrainIdToTrainScheduleId(Number(_editoastTrainId));
        formattedRawSummaries.set(formattedTrainId, trainSummary);
      }

      const summaries = formatTrainScheduleSummaries(
        [trainId],
        formattedRawSummaries,
        mapBy([updatedTrainScheduleResult], 'id'),
        rollingStocks!
      );
      setTrainScheduleSummariesById((prev) => {
        const newTrainScheduleSummariesById = new Map(prev);
        newTrainScheduleSummariesById.set(trainId, summaries.get(trainId)!);
        return newTrainScheduleSummariesById;
      });

      // fetch conflicts
      refetchConflicts();
    },
    [trainSchedules, rollingStocks]
  );

  const results = useMemo(
    () => ({
      trainScheduleSummaries,
      trainSchedules,
      projectionData:
        trainScheduleUsedForProjection && projectionPath
          ? {
              trainSchedule: trainScheduleUsedForProjection,
              ...projectionPath,
              projectedTrains,
              projectionLoaderData: {
                allTrainsProjected,
                totalTrains: trainSchedulesResults.length,
              },
            }
          : undefined,
      conflicts,
      removeTrains,
      upsertTrainSchedules,
      updateTrainDepartureTime,
    }),
    [
      trainScheduleSummaries,
      trainSchedules,
      trainScheduleUsedForProjection,
      projectionPath,
      projectedTrains,
      allTrainsProjected,
      trainSchedulesResults.length,
      conflicts,
      removeTrains,
      upsertTrainSchedules,
      updateTrainDepartureTime,
    ]
  );

  return results;
};

export default useScenarioData;
