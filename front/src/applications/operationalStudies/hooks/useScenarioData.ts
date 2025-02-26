import { useCallback, useEffect, useMemo, useState } from 'react';

import { keyBy, sortBy } from 'lodash';
import { useSelector } from 'react-redux';

import {
  osrdEditoastApi,
  type InfraWithState,
  type ScenarioResponse,
  type SimulationSummaryResult,
} from 'common/api/osrdEditoastApi';
import useLazyProjectTrains from 'modules/simulationResult/components/SpaceTimeChart/useLazyProjectTrains';
import { getOperationalStudiesElectricalProfileSetId } from 'reducers/osrdconf/operationalStudiesConf/selectors';
import type {
  PacedTrainResultWithPacedTrainId,
  TimetableItemId,
  TimetableItemWithTimetableId,
  TrainScheduleId,
  TrainScheduleResultWithTrainId,
} from 'reducers/osrdconf/types';
import { getTrainIdUsedForProjection } from 'reducers/simulationResults/selectors';
import { getShowPacedTrains } from 'reducers/user/userSelectors';
import {
  formatEditoastTrainIdToPacedTrainId,
  formatEditoastTrainIdToTrainScheduleId,
  formatTrainScheduleIdToEditoastTrainId,
  isPacedTrain,
} from 'utils/trainId';
import { mapBy } from 'utils/types';

import useAutoUpdateProjection from './useAutoUpdateProjection';
import useLazyLoadTimetableItems from './useLazyLoadTimatableItems';
import usePathProjection from './usePathProjection';
import formatTimetableItemSummaries from '../helpers/formatTimetableItemSummaries';

const useScenarioData = (scenario: ScenarioResponse, infra: InfraWithState) => {
  const electricalProfileSetId = useSelector(getOperationalStudiesElectricalProfileSetId);
  const trainIdUsedForProjection = useSelector(getTrainIdUsedForProjection);
  const showPacedTrains = useSelector(getShowPacedTrains);

  // TODO Paced trains : remove these 3 states in https://github.com/OpenRailAssociation/osrd/issues/10791
  const [trainIdsToProject, setTrainIdsToProject] = useState<Set<TimetableItemId>>(new Set());

  const [timetableItems, setTimetableItems] = useState<TimetableItemWithTimetableId[]>();
  const [timetableItemIdsToFetch, setTimetableItemIdsToFetch] = useState<TimetableItemId[]>();

  const [putTrainScheduleById] = osrdEditoastApi.endpoints.putTrainScheduleById.useMutation();
  const [postTrainScheduleSimulationSummary] =
    osrdEditoastApi.endpoints.postTrainScheduleSimulationSummary.useLazyQuery();
  const { data: { results: rollingStocks } = { results: null } } =
    osrdEditoastApi.endpoints.getLightRollingStock.useQuery({ pageSize: 1000 });

  const projectionPath = usePathProjection(infra);

  const { data: fetchedTrainSchedulesResults } =
    osrdEditoastApi.endpoints.getAllTimetableByIdTrainSchedules.useQuery(
      { timetableId: scenario?.timetable_id },
      {
        skip: !scenario,
      }
    );

  const { data: fetchedPacedTrains } =
    osrdEditoastApi.endpoints.getAllTimetableByIdPacedTrains.useQuery(
      { timetableId: scenario?.timetable_id },
      {
        skip: !scenario || !showPacedTrains,
      }
    );

  const formattedRawTrainSchedules = useMemo(
    () =>
      (fetchedTrainSchedulesResults || []).map((trainSchedule) => ({
        ...trainSchedule,
        id: formatEditoastTrainIdToTrainScheduleId(trainSchedule.id),
      })),
    [fetchedTrainSchedulesResults]
  );

  const formattedRawPacedTrains: PacedTrainResultWithPacedTrainId[] = useMemo(
    () =>
      showPacedTrains
        ? (fetchedPacedTrains || []).map((pacedTrain) => ({
            ...pacedTrain,
            id: formatEditoastTrainIdToPacedTrainId(pacedTrain.id),
          }))
        : [],
    [showPacedTrains, fetchedPacedTrains]
  );

  // TODO Paced trains : pass setTimetableItemIdsToProject in https://github.com/OpenRailAssociation/osrd/issues/10613
  const { timetableItemSummariesById, setTimetableItemSummariesById, allTimetableItemsLoaded } =
    useLazyLoadTimetableItems({
      infraId: scenario.infra_id,
      electricalProfileSetId,
      timetableItemIdsToFetch,
      timetableItems,
    });

  useEffect(() => {
    if (allTimetableItemsLoaded) {
      setTimetableItemIdsToFetch([]);
    }
  }, [allTimetableItemsLoaded]);

  // TODO Paced trains : remove this hook in https://github.com/OpenRailAssociation/osrd/issues/10791
  const { projectedTrainsById, allTrainsProjected, setProjectedTrainsById } = useLazyProjectTrains({
    infraId: scenario.infra_id,
    electricalProfileSetId,
    trainIdsToProject,
    path: projectionPath?.path,
    timetableItems,
    moreTrainsToCome: !allTimetableItemsLoaded,
    setTrainIdsToProject,
  });

  // TODO Paced trains : create a new useLazyProjectTimetableItems in https://github.com/OpenRailAssociation/osrd/issues/10613

  useEffect(() => {
    if (timetableItems && projectionPath?.path && allTimetableItemsLoaded) {
      // TODO Paced train : Adapt this to handle paced trains in issue https://github.com/OpenRailAssociation/osrd/issues/10613
      const trainIds = timetableItems.map((timetableItem) => timetableItem.id);
      setTrainIdsToProject(new Set(trainIds));
    }
  }, [projectionPath?.path]);

  // TODO Paced trains : adapt this to handle paced trains in the conflicts issue
  const { data: conflicts, refetch: refetchConflicts } =
    osrdEditoastApi.endpoints.getTimetableByIdConflicts.useQuery(
      {
        id: scenario.timetable_id,
        infraId: scenario.infra_id,
      },
      {
        skip: !allTimetableItemsLoaded,
      }
    );

  const timetableItemWithDetails = useMemo(() => {
    let filteredTimetableItemsSummaries = Array.from(timetableItemSummariesById.values());
    // Allow to hide or show paced trains in the timetable when toggling the paced train mode in the settings
    if (!showPacedTrains) {
      filteredTimetableItemsSummaries = filteredTimetableItemsSummaries.filter(
        (timetableItem) => !isPacedTrain(timetableItem.id)
      );
    }
    return sortBy(filteredTimetableItemsSummaries, 'startTime');
  }, [timetableItemSummariesById, showPacedTrains]);

  // TODO Paced trains : remove this in https://github.com/OpenRailAssociation/osrd/issues/10791
  const projectedTrains = useMemo(
    () => Array.from(projectedTrainsById.values()),
    [projectedTrainsById]
  );

  // TODO Paced trains : remove this in https://github.com/OpenRailAssociation/osrd/issues/10791
  const trainScheduleUsedForProjection = useMemo(
    () => timetableItems?.find((timetableItem) => timetableItem.id === trainIdUsedForProjection),
    [trainIdUsedForProjection, timetableItems]
  );

  const trainScheduleIds = useMemo(
    () => (fetchedTrainSchedulesResults || []).map((t) => t.id),
    [fetchedTrainSchedulesResults]
  );

  // TODO Paced train : Adapt this to accept paced trains in issue https://github.com/OpenRailAssociation/osrd/issues/10613
  useAutoUpdateProjection(infra, trainScheduleIds, timetableItemWithDetails);

  useEffect(() => {
    const sortedTimatableItems = sortBy(
      [...formattedRawTrainSchedules, ...formattedRawPacedTrains],
      'start_time'
    );
    setTimetableItems(sortedTimatableItems);
  }, [formattedRawTrainSchedules, formattedRawPacedTrains]);

  // first load of the summaries
  useEffect(() => {
    // TODO Paced trains : remove the if and extra depth in https://github.com/OpenRailAssociation/osrd/issues/10791
    // We also want to update timetableItemIdsToFetch if it's the first time we activate the paced train mode
    // pacedTrainWithDetails.length will be equal to 0 at that point
    const pacedTrainWithDetails = timetableItemWithDetails.filter((timetableItem) =>
      isPacedTrain(timetableItem.id)
    );
    if (
      timetableItems &&
      infra.state === 'CACHED' &&
      (timetableItemWithDetails.length === 0 || pacedTrainWithDetails.length === 0)
    ) {
      const timetableItemIds = timetableItems.map((timetableItem) => timetableItem.id);
      setTimetableItemIdsToFetch(timetableItemIds);
    }
  }, [timetableItems, infra.state]);

  const upsertTimetableItems = useCallback(
    (timetableItemsToUpsert: TimetableItemWithTimetableId[]) => {
      // TODO Paced train : Add logic for projected timetable items in https://github.com/OpenRailAssociation/osrd/issues/10613
      setProjectedTrainsById((prev) => {
        const newProjectedTrainsById = new Map(prev);
        timetableItemsToUpsert.forEach((trainSchedule) => {
          newProjectedTrainsById.delete(trainSchedule.id);
        });
        return newProjectedTrainsById;
      });

      setTimetableItems((prev) => sortBy([...prev!, ...timetableItemsToUpsert], 'start_time'));

      const sortedTimatableItemsToUpsert = sortBy(timetableItemsToUpsert, 'start_time');
      setTimetableItemIdsToFetch(
        sortedTimatableItemsToUpsert.map((timetableItem) => timetableItem.id)
      );
    },
    []
  );

  const removeTimetableItems = useCallback((_timetableItemsToRemove: TimetableItemId[]) => {
    setTimetableItems((prev) => {
      const timetableItemsById = mapBy(prev, 'id');
      _timetableItemsToRemove.forEach((timetableItemId) => {
        timetableItemsById.delete(timetableItemId);
      });
      return Array.from(timetableItemsById.values());
    });

    setTimetableItemSummariesById((prev) => {
      const newTimetableItemsSummariesById = new Map(prev);
      _timetableItemsToRemove.forEach((timetableItemId) => {
        newTimetableItemsSummariesById.delete(timetableItemId);
      });
      return newTimetableItemsSummariesById;
    });

    // TODO Paced train : Add logic for projected timetable items in https://github.com/OpenRailAssociation/osrd/issues/10613
    setProjectedTrainsById((prev) => {
      const newProjectedTrainsById = new Map(prev);
      _timetableItemsToRemove.forEach((trainId) => {
        newProjectedTrainsById.delete(trainId as TrainScheduleId);
      });
      return newProjectedTrainsById;
    });
  }, []);

  // TODO Paced train : change this function to handle paced trains in https://github.com/OpenRailAssociation/osrd/issues/10781
  /** Update only depature time of a train */
  const updateTrainDepartureTime = useCallback(
    async (trainId: TimetableItemId, newDeparture: Date) => {
      const editoastTrainId = formatTrainScheduleIdToEditoastTrainId(trainId as TrainScheduleId);

      const trainSchedule = timetableItems?.find((timetableItem) => timetableItem.id === trainId);

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

      setTimetableItems((prev) => {
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

      const formattedRawSummaries: Map<TrainScheduleId, SimulationSummaryResult> = new Map();
      for (const [_editoastTrainId, trainSummary] of Object.entries(rawSummaries)) {
        const formattedTrainId = formatEditoastTrainIdToTrainScheduleId(Number(_editoastTrainId));
        formattedRawSummaries.set(formattedTrainId, trainSummary);
      }

      const summaries = formatTimetableItemSummaries(
        [trainId],
        formattedRawSummaries,
        mapBy([updatedTrainScheduleResult], 'id'),
        rollingStocks!
      );
      setTimetableItemSummariesById((prev) => {
        const newTrainScheduleSummariesById = new Map(prev);
        newTrainScheduleSummariesById.set(trainId, summaries.get(trainId)!);
        return newTrainScheduleSummariesById;
      });

      // fetch conflicts
      refetchConflicts();
    },
    [timetableItems, rollingStocks]
  );

  const results = useMemo(
    () => ({
      timetableItemWithDetails,
      timetableItems,
      projectionData:
        trainScheduleUsedForProjection && projectionPath
          ? {
              trainSchedule: trainScheduleUsedForProjection,
              ...projectionPath,
              projectedTrains,
              projectionLoaderData: {
                allTrainsProjected,
                totalTrains: formattedRawTrainSchedules.length,
              },
            }
          : undefined,
      conflicts,
      removeTimetableItems,
      upsertTimetableItems,
      updateTrainDepartureTime,
    }),
    [
      timetableItemWithDetails,
      timetableItems,
      trainScheduleUsedForProjection,
      projectionPath,
      projectedTrains,
      allTrainsProjected,
      formattedRawTrainSchedules.length,
      conflicts,
      removeTimetableItems,
      upsertTimetableItems,
      updateTrainDepartureTime,
    ]
  );

  return results;
};

export default useScenarioData;
