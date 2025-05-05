import { useCallback, useEffect, useMemo, useState, useRef } from 'react';

import { keyBy, sortBy } from 'lodash';
import { useSelector } from 'react-redux';

import {
  osrdEditoastApi,
  type InfraWithState,
  type ScenarioResponse,
} from 'common/api/osrdEditoastApi';
import useLazyProjectTrains from 'modules/simulationResult/components/SpaceTimeChart/useLazyProjectTrains';
import { getOperationalStudiesElectricalProfileSetId } from 'reducers/osrdconf/operationalStudiesConf/selectors';
import type {
  PacedTrainResponseWithPacedTrainId,
  TimetableItemId,
  TimetableItemWithTimetableId,
  TrainScheduleId,
  TrainScheduleResponseWithTrainId,
} from 'reducers/osrdconf/types';
import { getTrainIdUsedForProjection } from 'reducers/simulationResults/selectors';
import { getShowPacedTrains } from 'reducers/user/userSelectors';
import { useAppDispatch } from 'store';
import {
  formatEditoastIdToPacedTrainId,
  formatEditoastIdToTrainScheduleId,
  extractEditoastIdFromTrainScheduleId,
  isPacedTrainId,
} from 'utils/trainId';
import { mapBy } from 'utils/types';

import useAutoUpdateProjection from './useAutoUpdateProjection';
import useLazySimulateTrains from './useLazySimulateTrains';
import usePathProjection from './usePathProjection';

type ScenarioBroadcastMessage =
  | { type: 'upsertTimetableItems'; timetableItems: TimetableItemWithTimetableId[] }
  | { type: 'removeTimetableItems'; timetableItemIds: TimetableItemId[] }
  | { type: 'updateTrainDepartureTime'; timetableItemId: TimetableItemId; newDeparture: Date };

const useScenarioData = (scenario: ScenarioResponse, infra: InfraWithState) => {
  const dispatch = useAppDispatch();
  const electricalProfileSetId = useSelector(getOperationalStudiesElectricalProfileSetId);
  const trainIdUsedForProjection = useSelector(getTrainIdUsedForProjection);
  const showPacedTrains = useSelector(getShowPacedTrains);

  const [timetableItems, setTimetableItems] = useState<TimetableItemWithTimetableId[]>();
  const [timetableItemIdsToProject, setTimetableItemIdsToProject] = useState<Set<TimetableItemId>>(
    new Set()
  );

  const [putTrainScheduleById] = osrdEditoastApi.endpoints.putTrainScheduleById.useMutation();

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
        id: formatEditoastIdToTrainScheduleId(trainSchedule.id),
      })),
    [fetchedTrainSchedulesResults]
  );

  const formattedRawPacedTrains: PacedTrainResponseWithPacedTrainId[] = useMemo(
    () =>
      showPacedTrains
        ? (fetchedPacedTrains || []).map((pacedTrain) => ({
            ...pacedTrain,
            id: formatEditoastIdToPacedTrainId(pacedTrain.id),
          }))
        : [],
    [showPacedTrains, fetchedPacedTrains]
  );

  const {
    simulatedTrainsById,
    simulateTimetableItems,
    allTrainsSimulated,
    removeSimulatedTimetableItems,
  } = useLazySimulateTrains({
    infraId: scenario.infra_id,
    electricalProfileSetId,
    rollingStocks,
    onProgress: (summaries) => {
      // TODO Paced trains : remove this filter when paced trains are handled in projection
      setTimetableItemIdsToProject((prev) => new Set([...prev, ...summaries.keys()]));
    },
  });

  const { projectedTrainsById, allTrainsProjected, setProjectedTrainsById } = useLazyProjectTrains({
    infraId: scenario.infra_id,
    electricalProfileSetId,
    timetableItemIdsToProject,
    path: projectionPath?.path,
    timetableItems,
    moreTrainsToCome: !allTrainsSimulated,
    setTimetableItemIdsToProject,
  });

  useEffect(() => {
    if (timetableItems && projectionPath?.path && allTrainsSimulated) {
      const trainIds = timetableItems.map((timetableItem) => timetableItem.id);
      setTimetableItemIdsToProject(new Set(trainIds));
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
        skip: !allTrainsSimulated,
      }
    );

  const timetableItemsWithDetails = useMemo(() => {
    let filteredTimetableItemsSummaries = Array.from(simulatedTrainsById.values());
    // Allow to hide or show paced trains in the timetable when toggling the paced train mode in the settings
    if (!showPacedTrains) {
      filteredTimetableItemsSummaries = filteredTimetableItemsSummaries.filter(
        (timetableItem) => !isPacedTrainId(timetableItem.id)
      );
    }
    return sortBy(filteredTimetableItemsSummaries, 'startTime');
  }, [simulatedTrainsById, showPacedTrains]);

  const projectedTrains = useMemo(
    () => Array.from(projectedTrainsById.values()),
    [projectedTrainsById]
  );

  const trainScheduleUsedForProjection = useMemo(
    () => timetableItems?.find((timetableItem) => timetableItem.id === trainIdUsedForProjection),
    [trainIdUsedForProjection, timetableItems]
  );

  const timetableItemIds = useMemo(
    () => timetableItems?.map((item) => item.id) ?? [],
    [timetableItems]
  );

  useAutoUpdateProjection(infra, timetableItemIds, timetableItemsWithDetails);

  useEffect(() => {
    const sortedTimetableItems = [
      ...sortBy(formattedRawTrainSchedules, 'start_time'),
      ...sortBy(formattedRawPacedTrains, 'start_time'),
    ];
    setTimetableItems(sortedTimetableItems);
  }, [formattedRawTrainSchedules, formattedRawPacedTrains]);

  // first load of the summaries
  useEffect(() => {
    // TODO Paced trains : remove the if and extra depth in https://github.com/OpenRailAssociation/osrd/issues/10791
    // We also want to update timetableItemIdsToFetch if it's the first time we activate the paced train mode
    // pacedTrainWithDetails.length will be equal to 0 at that point
    const pacedTrainWithDetails = timetableItemsWithDetails.filter((timetableItem) =>
      isPacedTrainId(timetableItem.id)
    );
    if (
      timetableItems &&
      infra.state === 'CACHED' &&
      (timetableItemsWithDetails.length === 0 || pacedTrainWithDetails.length === 0)
    ) {
      simulateTimetableItems(timetableItems);
    }
  }, [timetableItems, infra.state]);

  const broadcastChannel = useRef<BroadcastChannel>();

  const broadcastScenarioMessage = (msg: ScenarioBroadcastMessage) => {
    broadcastChannel.current?.postMessage(msg);
  };

  const upsertTimetableItems = useCallback(
    (timetableItemsToUpsert: TimetableItemWithTimetableId[]) => {
      setProjectedTrainsById((prev) => {
        const newProjectedTrainsById = new Map(prev);
        timetableItemsToUpsert.forEach((trainSchedule) => {
          newProjectedTrainsById.delete(trainSchedule.id);
        });
        return newProjectedTrainsById;
      });

      setTimetableItems((prev) =>
        sortBy(
          Object.values({ ...keyBy(prev, 'id'), ...keyBy(timetableItemsToUpsert, 'id') }),
          'start_time'
        )
      );

      simulateTimetableItems(timetableItemsToUpsert);
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

    removeSimulatedTimetableItems(_timetableItemsToRemove);

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
      const editoastTrainId = extractEditoastIdFromTrainScheduleId(trainId as TrainScheduleId);

      const trainSchedule = timetableItems?.find((timetableItem) => timetableItem.id === trainId);

      if (!trainSchedule) {
        throw new Error('Train non trouvé');
      }

      const trainScheduleResponse = await putTrainScheduleById({
        id: editoastTrainId,
        trainScheduleForm: {
          ...trainSchedule,
          start_time: newDeparture.toISOString(),
        },
      }).unwrap();

      const updatedTrainScheduleResponse: TrainScheduleResponseWithTrainId = {
        ...trainScheduleResponse,
        id: formatEditoastIdToTrainScheduleId(trainScheduleResponse.id),
      };

      setProjectedTrainsById((prev) => {
        const newProjectedTrainsById = new Map(prev);
        newProjectedTrainsById.set(updatedTrainScheduleResponse.id, {
          ...newProjectedTrainsById.get(updatedTrainScheduleResponse.id)!,
          departureTime: newDeparture,
        });
        return newProjectedTrainsById;
      });

      setTimetableItems((prev) => {
        const newTrainSchedulesById = {
          ...keyBy(prev, 'id'),
          ...keyBy([updatedTrainScheduleResponse], 'id'),
        };
        return sortBy(Object.values(newTrainSchedulesById), 'start_time');
      });

      simulateTimetableItems([updatedTrainScheduleResponse]);

      // fetch conflicts
      refetchConflicts();
    },
    [timetableItems, rollingStocks]
  );

  const upsertTimetableItemsWithBroadcast = useCallback(
    (timetableItemsToUpsert: TimetableItemWithTimetableId[]) => {
      upsertTimetableItems(timetableItemsToUpsert);
      broadcastScenarioMessage({
        type: 'upsertTimetableItems',
        timetableItems: timetableItemsToUpsert,
      });
    },
    [upsertTimetableItems]
  );

  const removeTimetableItemsWithBroadcast = useCallback(
    (ids: TimetableItemId[]) => {
      removeTimetableItems(ids);
      broadcastScenarioMessage({
        type: 'removeTimetableItems',
        timetableItemIds: ids,
      });
    },
    [removeTimetableItems]
  );

  const updateTrainDepartureTimeWithBroadcast = useCallback(
    async (timetableItemId: TimetableItemId, newDeparture: Date) => {
      updateTrainDepartureTime(timetableItemId, newDeparture);
      broadcastScenarioMessage({
        type: 'updateTrainDepartureTime',
        timetableItemId,
        newDeparture,
      });
    },
    [updateTrainDepartureTime]
  );

  useEffect(() => {
    const channel = new BroadcastChannel(`osrd-scenario-${scenario.id}`);
    broadcastChannel.current = channel;

    channel.addEventListener('message', (event) => {
      const msg: ScenarioBroadcastMessage = event.data;

      switch (msg.type) {
        case 'upsertTimetableItems':
          upsertTimetableItems(msg.timetableItems);
          break;
        case 'removeTimetableItems':
          removeTimetableItems(msg.timetableItemIds);
          break;
        case 'updateTrainDepartureTime':
          updateTrainDepartureTime(msg.timetableItemId, msg.newDeparture);
          break;
        default:
          console.error('Unknown scenario broadcast channel message type:', msg);
          break;
      }

      dispatch(
        osrdEditoastApi.util.invalidateTags([
          'scenarios',
          'timetable',
          'train_schedule',
          'paced_train',
        ])
      );
    });

    return () => {
      channel.close();
      broadcastChannel.current = undefined;
    };
  }, [scenario]);

  const results = useMemo(
    () => ({
      timetableItemsWithDetails,
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
      removeTimetableItems: removeTimetableItemsWithBroadcast,
      upsertTimetableItems: upsertTimetableItemsWithBroadcast,
      updateTrainDepartureTime: updateTrainDepartureTimeWithBroadcast,
    }),
    [
      timetableItemsWithDetails,
      timetableItems,
      trainScheduleUsedForProjection,
      projectionPath,
      projectedTrains,
      allTrainsProjected,
      formattedRawTrainSchedules.length,
      conflicts,
      removeTimetableItemsWithBroadcast,
      upsertTimetableItemsWithBroadcast,
      updateTrainDepartureTimeWithBroadcast,
    ]
  );

  return results;
};

export default useScenarioData;
