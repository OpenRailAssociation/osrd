import { useCallback, useEffect, useMemo, useState, useRef } from 'react';

import { skipToken } from '@reduxjs/toolkit/query';
import { keyBy, sortBy } from 'lodash';

import { osrdEditoastApi, type ScenarioWithDetails } from 'common/api/osrdEditoastApi';
import { useRollingStockContext } from 'common/RollingStockContext';
import useLazyProjectTrains from 'modules/simulationResult/components/SpaceTimeChartWrapper/useLazyProjectTrains';
import { formatPacedTrainWithDetails } from 'modules/timetableItem/helpers/formatTrainScheduleWithDetails';
import type { TimetableItem } from 'reducers/osrdconf/types';
import { useAppDispatch } from 'store';
import { mapBy } from 'utils/types';

import useAutoSelectTrainIds from './useAutoSelectTrainIds';
import useLazySimulateTrains from './useLazySimulateTrains';
import usePathProjection from './usePathProjection';
import { useScenarioContext } from './useScenarioContext';

type ScenarioBroadcastMessage =
  | { type: 'upsertTrainSchedules'; trainSchedules: TimetableItem[] }
  | { type: 'removeTrainSchedules'; trainScheduleIds: number[] }
  | { type: 'setTrainScheduleDepartureTime'; trainScheduleId: number; newDeparture: Date };

const useScenarioData = (scenario: ScenarioWithDetails, infraId: number, timetableId: number) => {
  const dispatch = useAppDispatch();

  const [timetableItems, setTimetableItems] = useState<TimetableItem[]>();
  const timetableItemsById = useMemo(() => mapBy(timetableItems, 'id'), [timetableItems]);
  const [selectedTrainScheduleIds, setSelectedTrainScheduleIds] = useState<number[]>([]);

  const [updateTrainSchedule] = osrdEditoastApi.endpoints.putTrainSchedulesById.useMutation();

  const { workerStatus } = useScenarioContext();
  const { rollingStocks, rollingStockMap: rollingStocksByName } = useRollingStockContext();

  const projectionPath = usePathProjection(infraId, timetableItemsById);

  useEffect(() => {
    const pacedTrainsResult = dispatch(
      osrdEditoastApi.endpoints.getAllTimetableByIdTrainSchedules.initiate({
        timetableId: scenario.timetable_id,
      })
    );

    const fetchTimetableItems = async () => {
      const pacedTrains = (await pacedTrainsResult.unwrap()) ?? [];

      setTimetableItems(sortBy(pacedTrains, 'start_time'));
    };

    fetchTimetableItems();

    return () => {
      pacedTrainsResult.unsubscribe();
    };
  }, [scenario.timetable_id]);

  const {
    projectedTrainsById,
    allTrainsProjected,
    projectTrainSchedules,
    removeProjectedTrainSchedules,
    updateProjectedTrainScheduleDepartureTime,
  } = useLazyProjectTrains({
    infraId,
    timetableId: scenario.timetable_id,
    electricalProfileSetId: scenario.electrical_profile_set_id,
    path:
      projectionPath?.pathfindingStatus === 'succeeded'
        ? projectionPath.pathfinding.path
        : undefined,
    operationalPointDistances: projectionPath?.operationalPointDistances,
    operationalPointReferences: projectionPath?.operationalPointReferences,
  });

  const {
    simulatedTrainsById,
    simulateTrainSchedules,
    allTrainsSimulated,
    removeSimulatedTrainSchedules,
    updateSimulatedTrainScheduleDepartureTime,
  } = useLazySimulateTrains({
    infraId,
    timetableId,
    electricalProfileSetId: scenario.electrical_profile_set_id,
    rollingStocks,
    onProgress: (summaries) => {
      projectTrainSchedules([...summaries.keys()].map((id) => timetableItemsById.get(id)!));
    },
  });

  // TODO Paced trains : adapt this to handle paced trains in the conflicts issue
  // TODO: investigate why RTK Query returns undefined here despite isFetching and isUninitialized being false and the API always returning a list
  const {
    data: conflictsData,
    isUninitialized,
    isFetching,
  } = osrdEditoastApi.endpoints.getTimetableByIdConflicts.useQuery(
    allTrainsSimulated ? { id: scenario.timetable_id, infraId: scenario.infra_id } : skipToken
  );
  const conflicts = useMemo(() => conflictsData ?? [], [conflictsData]);

  const isConflictsLoading = isUninitialized || isFetching;

  const trainSchedulesWithDetails = useMemo(() => {
    const items = (timetableItems || []).map((timetableItem) => {
      const simulatedTrain = simulatedTrainsById.get(timetableItem.id);
      if (simulatedTrain) return simulatedTrain;
      const rollingStock = rollingStocksByName.get(timetableItem.rolling_stock_name);
      return formatPacedTrainWithDetails(timetableItem, rollingStock);
    });
    return sortBy(items, ['startTime', 'name', 'id']);
  }, [timetableItems, rollingStocksByName, simulatedTrainsById]);

  const projectedTrains = useMemo(
    () => Array.from(projectedTrainsById.values()),
    [projectedTrainsById]
  );

  useAutoSelectTrainIds(timetableItems ? trainSchedulesWithDetails : undefined);

  // first load of the summaries
  useEffect(() => {
    if (timetableItems && workerStatus === 'READY' && simulatedTrainsById.size === 0) {
      simulateTrainSchedules(timetableItems);
    }
  }, [timetableItems, workerStatus, simulatedTrainsById]);

  const broadcastChannel = useRef<BroadcastChannel>(null);

  const broadcastScenarioMessage = (msg: ScenarioBroadcastMessage) => {
    broadcastChannel.current?.postMessage(msg);
  };

  const upsertTrainSchedules = useCallback((trainSchedulesToUpsert: TimetableItem[]) => {
    setTimetableItems((prev) =>
      sortBy(
        Object.values({ ...keyBy(prev, 'id'), ...keyBy(trainSchedulesToUpsert, 'id') }),
        'start_time'
      )
    );

    removeSimulatedTrainSchedules(trainSchedulesToUpsert.map((trainSchedule) => trainSchedule.id));
    removeProjectedTrainSchedules(trainSchedulesToUpsert.map((trainSchedule) => trainSchedule.id));
    simulateTrainSchedules(trainSchedulesToUpsert);
  }, []);

  const removeTrainSchedules = useCallback((_trainSchedulesToRemove: number[]) => {
    setTimetableItems((prev) => {
      const prevTimetableItemsById = mapBy(prev, 'id');
      _trainSchedulesToRemove.forEach((trainScheduleId) => {
        prevTimetableItemsById.delete(trainScheduleId);
      });
      return Array.from(prevTimetableItemsById.values());
    });

    setSelectedTrainScheduleIds((prevSelected) =>
      prevSelected.filter((id) => !_trainSchedulesToRemove.includes(id))
    );

    removeSimulatedTrainSchedules(_trainSchedulesToRemove);
    removeProjectedTrainSchedules(_trainSchedulesToRemove);
  }, []);

  const setTrainScheduleDepartureTime = useCallback(
    (trainScheduleId: number, newDeparture: Date) => {
      setTimetableItems((prev) => {
        const timetableItem = prev?.find((item) => item.id === trainScheduleId);
        if (!timetableItem) {
          return prev;
        }
        const updatedTimetableItem = {
          ...timetableItem,
          start_time: newDeparture.toISOString(),
        };
        const newTimetableItemsById = {
          ...keyBy(prev, 'id'),
          ...keyBy([updatedTimetableItem], 'id'),
        };
        return sortBy(Object.values(newTimetableItemsById), 'start_time');
      });

      updateSimulatedTrainScheduleDepartureTime(trainScheduleId, newDeparture);
      updateProjectedTrainScheduleDepartureTime(trainScheduleId, newDeparture);
    },
    []
  );

  /** Update only departure time of a train schedule */
  const updateTrainScheduleDepartureTime = useCallback(
    async (trainScheduleId: number, newDeparture: Date) => {
      const timetableItem = timetableItems?.find((item) => item.id === trainScheduleId);
      if (!timetableItem) {
        throw new Error(`Timetable item "${trainScheduleId}" not found`);
      }

      await updateTrainSchedule({
        id: timetableItem.id,
        trainSchedule: {
          ...timetableItem,
          start_time: newDeparture.toISOString(),
        },
      }).unwrap();

      setTrainScheduleDepartureTime(trainScheduleId, newDeparture);
    },
    [timetableItems]
  );

  const upsertTrainSchedulesWithBroadcast = useCallback(
    (trainSchedulesToUpsert: TimetableItem[]) => {
      upsertTrainSchedules(trainSchedulesToUpsert);
      broadcastScenarioMessage({
        type: 'upsertTrainSchedules',
        trainSchedules: trainSchedulesToUpsert,
      });
    },
    [upsertTrainSchedules]
  );

  const removeTrainSchedulesWithBroadcast = useCallback(
    (ids: number[]) => {
      removeTrainSchedules(ids);
      broadcastScenarioMessage({
        type: 'removeTrainSchedules',
        trainScheduleIds: ids,
      });
    },
    [removeTrainSchedules]
  );

  const updateTrainScheduleDepartureTimeWithBroadcast = useCallback(
    async (trainScheduleId: number, newDeparture: Date) => {
      await updateTrainScheduleDepartureTime(trainScheduleId, newDeparture);
      broadcastScenarioMessage({
        type: 'setTrainScheduleDepartureTime',
        trainScheduleId,
        newDeparture,
      });
    },
    [updateTrainScheduleDepartureTime]
  );

  useEffect(() => {
    const channel = new BroadcastChannel(`osrd-scenario-${scenario.id}`);
    broadcastChannel.current = channel;

    channel.addEventListener('message', (event) => {
      const msg: ScenarioBroadcastMessage = event.data;

      switch (msg.type) {
        case 'upsertTrainSchedules':
          upsertTrainSchedules(msg.trainSchedules);
          break;
        case 'removeTrainSchedules':
          removeTrainSchedules(msg.trainScheduleIds);
          break;
        case 'setTrainScheduleDepartureTime':
          setTrainScheduleDepartureTime(msg.trainScheduleId, msg.newDeparture);
          break;
        default:
          console.error('Unknown scenario broadcast channel message type:', msg);
          break;
      }

      dispatch(osrdEditoastApi.util.invalidateTags(['scenarios', 'timetable', 'train_schedule']));
    });

    return () => {
      channel.close();
      broadcastChannel.current = null;
    };
  }, [scenario]);

  const results = useMemo(
    () => ({
      trainSchedulesWithDetails,
      timetableItems,
      projectionData: projectionPath
        ? {
            ...projectionPath,
            projectedTrains,
            projectionLoaderData: {
              allTrainsProjected,
              totalTrains: timetableItems?.length ?? 0,
            },
          }
        : undefined,
      conflicts,
      isConflictsLoading,
      removeTrainSchedules: removeTrainSchedulesWithBroadcast,
      upsertTrainSchedules: upsertTrainSchedulesWithBroadcast,
      updateTrainScheduleDepartureTime: updateTrainScheduleDepartureTimeWithBroadcast,
      selectedTrainScheduleIds,
      setSelectedTrainScheduleIds,
    }),
    [
      trainSchedulesWithDetails,
      timetableItems,
      projectionPath,
      projectedTrains,
      allTrainsProjected,
      timetableItems?.length ?? 0,
      conflicts,
      isConflictsLoading,
      rollingStocks,
      removeTrainSchedulesWithBroadcast,
      upsertTrainSchedulesWithBroadcast,
      updateTrainScheduleDepartureTimeWithBroadcast,
      selectedTrainScheduleIds,
    ]
  );

  return results;
};

export default useScenarioData;
