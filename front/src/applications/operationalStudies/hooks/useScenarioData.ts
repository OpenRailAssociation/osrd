import { useCallback, useEffect, useMemo, useState, useRef } from 'react';

import { skipToken } from '@reduxjs/toolkit/query';
import { keyBy, sortBy } from 'lodash';
import { useSelector } from 'react-redux';

import { osrdEditoastApi, type ScenarioResponse } from 'common/api/osrdEditoastApi';
import { useRollingStockContext } from 'common/RollingStockContext';
import useLazyProjectTrains from 'modules/simulationResult/components/SpaceTimeChartWrapper/useLazyProjectTrains';
import {
  formatPacedTrainWithDetails,
  formatTrainScheduleWithDetails,
} from 'modules/timetableItem/helpers/formatTimetableItemWithDetails';
import { getExceptionFromOccurrenceId } from 'modules/timetableItem/helpers/pacedTrain';
import type { TimetableItemId, TimetableItem } from 'reducers/osrdconf/types';
import { getTrainIdUsedForProjection } from 'reducers/simulationResults/selectors';
import { useAppDispatch } from 'store';
import {
  formatEditoastIdToPacedTrainId,
  formatEditoastIdToTrainScheduleId,
  extractEditoastIdFromTrainScheduleId,
  extractEditoastIdFromPacedTrainId,
  isPacedTrainResponseWithPacedTrainId,
  isOccurrenceId,
  extractPacedTrainIdFromOccurrenceId,
} from 'utils/trainId';
import { mapBy } from 'utils/types';

import useAutoSelectTrainIds from './useAutoSelectTrainIds';
import useLazySimulateTrains from './useLazySimulateTrains';
import usePathProjection from './usePathProjection';
import { useScenarioContext } from './useScenarioContext';

type ScenarioBroadcastMessage =
  | { type: 'upsertTimetableItems'; timetableItems: TimetableItem[] }
  | { type: 'removeTimetableItems'; timetableItemIds: TimetableItemId[] }
  | { type: 'setTimetableItemDepartureTime'; timetableItemId: TimetableItemId; newDeparture: Date };

const useScenarioData = (scenario: ScenarioResponse, infraId: number) => {
  const dispatch = useAppDispatch();
  const trainIdUsedForProjection = useSelector(getTrainIdUsedForProjection);

  const [timetableItems, setTimetableItems] = useState<TimetableItem[]>();
  const timetableItemsById = useMemo(() => mapBy(timetableItems, 'id'), [timetableItems]);

  const [putTrainScheduleById] = osrdEditoastApi.endpoints.putTrainScheduleById.useMutation();
  const [putPacedTrainById] = osrdEditoastApi.endpoints.putPacedTrainById.useMutation();

  const { workerStatus } = useScenarioContext();
  const { rollingStocks, rollingStockMap: rollingStocksByName } = useRollingStockContext();

  const projectionPath = usePathProjection(infraId, timetableItemsById);

  useEffect(() => {
    const trainSchedulesResult = dispatch(
      osrdEditoastApi.endpoints.getAllTimetableByIdTrainSchedules.initiate({
        timetableId: scenario.timetable_id,
      })
    );
    const pacedTrainsResult = dispatch(
      osrdEditoastApi.endpoints.getAllTimetableByIdPacedTrains.initiate({
        timetableId: scenario.timetable_id,
      })
    );

    const fetchTimetableItems = async () => {
      const rawTrainSchedules = await trainSchedulesResult.unwrap();
      const rawPacedTrains = (await pacedTrainsResult?.unwrap()) ?? [];

      const trainSchedules = rawTrainSchedules.map((trainSchedule) => ({
        ...trainSchedule,
        id: formatEditoastIdToTrainScheduleId(trainSchedule.id),
      }));
      const pacedTrains = rawPacedTrains.map((pacedTrain) => ({
        ...pacedTrain,
        id: formatEditoastIdToPacedTrainId(pacedTrain.id),
      }));

      setTimetableItems([
        ...sortBy(trainSchedules, 'start_time'),
        ...sortBy(pacedTrains, 'start_time'),
      ]);
    };

    fetchTimetableItems();

    return () => {
      trainSchedulesResult.unsubscribe();
      pacedTrainsResult?.unsubscribe();
    };
  }, [scenario.timetable_id]);

  const {
    projectedTrainsById,
    allTrainsProjected,
    projectTimetableItems,
    removeProjectedTimetableItems,
    updateProjectedTimetableItemDepartureTime,
  } = useLazyProjectTrains({
    infraId,
    electricalProfileSetId: scenario.electrical_profile_set_id,
    path: projectionPath?.pathfinding,
    operationalPoints: projectionPath?.operationalPoints,
  });

  const {
    simulatedTrainsById,
    simulateTimetableItems,
    allTrainsSimulated,
    removeSimulatedTimetableItems,
    updateSimulatedTimetableItemDepartureTime,
  } = useLazySimulateTrains({
    infraId,
    electricalProfileSetId: scenario.electrical_profile_set_id,
    rollingStocks,
    onProgress: (summaries) => {
      projectTimetableItems([...summaries.keys()].map((id) => timetableItemsById.get(id)!));
    },
  });

  // TODO Paced trains : adapt this to handle paced trains in the conflicts issue
  const {
    data: conflicts,
    isLoading,
    isFetching,
  } = osrdEditoastApi.endpoints.getTimetableByIdConflicts.useQuery(
    allTrainsSimulated ? { id: scenario.timetable_id, infraId: scenario.infra_id } : skipToken
  );

  const isConflictsLoading = isLoading || isFetching;

  const timetableItemsWithDetails = useMemo(() => {
    const items = (timetableItems || []).map((timetableItem) => {
      const simulatedTrain = simulatedTrainsById.get(timetableItem.id);
      if (simulatedTrain) return simulatedTrain;
      const rollingStock = rollingStocksByName.get(timetableItem.rolling_stock_name);
      return isPacedTrainResponseWithPacedTrainId(timetableItem)
        ? formatPacedTrainWithDetails(timetableItem, rollingStock)
        : formatTrainScheduleWithDetails(timetableItem, rollingStock);
    });
    return sortBy(items, ['startTime', 'name', 'id']);
  }, [timetableItems, rollingStocksByName, simulatedTrainsById]);

  const projectedTrains = useMemo(
    () => Array.from(projectedTrainsById.values()),
    [projectedTrainsById]
  );

  const pathUsedForProjection = useMemo(() => {
    if (!trainIdUsedForProjection) return undefined;
    if (!isOccurrenceId(trainIdUsedForProjection)) {
      return timetableItemsById.get(trainIdUsedForProjection)?.path;
    }
    const pacedTrain = timetableItemsById.get(
      extractPacedTrainIdFromOccurrenceId(trainIdUsedForProjection)
    );
    const exception = getExceptionFromOccurrenceId(timetableItemsById, trainIdUsedForProjection);
    return exception?.path_and_schedule?.path ?? pacedTrain!.path;
  }, [trainIdUsedForProjection, timetableItems]);

  const timetableItemIds = useMemo(() => timetableItems?.map((item) => item.id), [timetableItems]);

  useAutoSelectTrainIds(timetableItemIds, timetableItemsWithDetails);

  // first load of the summaries
  useEffect(() => {
    if (timetableItems && workerStatus === 'READY' && simulatedTrainsById.size === 0) {
      simulateTimetableItems(timetableItems);
    }
  }, [timetableItems, workerStatus, simulatedTrainsById]);

  const broadcastChannel = useRef<BroadcastChannel>(null);

  const broadcastScenarioMessage = (msg: ScenarioBroadcastMessage) => {
    broadcastChannel.current?.postMessage(msg);
  };

  const upsertTimetableItems = useCallback((timetableItemsToUpsert: TimetableItem[]) => {
    setTimetableItems((prev) =>
      sortBy(
        Object.values({ ...keyBy(prev, 'id'), ...keyBy(timetableItemsToUpsert, 'id') }),
        'start_time'
      )
    );

    removeProjectedTimetableItems(timetableItemsToUpsert.map((item) => item.id));

    simulateTimetableItems(timetableItemsToUpsert);
  }, []);

  const removeTimetableItems = useCallback((_timetableItemsToRemove: TimetableItemId[]) => {
    setTimetableItems((prev) => {
      const prevTimetableItemsById = mapBy(prev, 'id');
      _timetableItemsToRemove.forEach((timetableItemId) => {
        prevTimetableItemsById.delete(timetableItemId);
      });
      return Array.from(prevTimetableItemsById.values());
    });

    removeSimulatedTimetableItems(_timetableItemsToRemove);
    removeProjectedTimetableItems(_timetableItemsToRemove);
  }, []);

  const setTimetableItemDepartureTime = useCallback(
    (timetableItemId: TimetableItemId, newDeparture: Date) => {
      setTimetableItems((prev) => {
        const timetableItem = prev?.find((item) => item.id === timetableItemId);
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

      updateSimulatedTimetableItemDepartureTime(timetableItemId, newDeparture);
      updateProjectedTimetableItemDepartureTime(timetableItemId, newDeparture);
    },
    []
  );

  /** Update only departure time of a timetable item */
  const updateTrainDepartureTime = useCallback(
    async (timetableItemId: TimetableItemId, newDeparture: Date) => {
      const timetableItem = timetableItems?.find((item) => item.id === timetableItemId);
      if (!timetableItem) {
        throw new Error(`Timetable item "${timetableItemId}" not found`);
      }

      if (isPacedTrainResponseWithPacedTrainId(timetableItem)) {
        const editoastPacedTrainId = extractEditoastIdFromPacedTrainId(timetableItem.id);

        await putPacedTrainById({
          id: editoastPacedTrainId,
          body: {
            ...timetableItem,
            start_time: newDeparture.toISOString(),
          },
        }).unwrap();
      } else {
        const editoastTrainId = extractEditoastIdFromTrainScheduleId(timetableItem.id);

        await putTrainScheduleById({
          id: editoastTrainId,
          trainScheduleForm: {
            ...timetableItem,
            start_time: newDeparture.toISOString(),
          },
        }).unwrap();
      }

      setTimetableItemDepartureTime(timetableItemId, newDeparture);
    },
    [timetableItems]
  );

  const upsertTimetableItemsWithBroadcast = useCallback(
    (timetableItemsToUpsert: TimetableItem[]) => {
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
      await updateTrainDepartureTime(timetableItemId, newDeparture);
      broadcastScenarioMessage({
        type: 'setTimetableItemDepartureTime',
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
        case 'setTimetableItemDepartureTime':
          setTimetableItemDepartureTime(msg.timetableItemId, msg.newDeparture);
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
      broadcastChannel.current = null;
    };
  }, [scenario]);

  const results = useMemo(
    () => ({
      timetableItemsWithDetails,
      timetableItems,
      projectionData:
        pathUsedForProjection && projectionPath
          ? {
              path: pathUsedForProjection,
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
      removeTimetableItems: removeTimetableItemsWithBroadcast,
      upsertTimetableItems: upsertTimetableItemsWithBroadcast,
      updateTrainDepartureTime: updateTrainDepartureTimeWithBroadcast,
    }),
    [
      timetableItemsWithDetails,
      timetableItems,
      pathUsedForProjection,
      projectionPath,
      projectedTrains,
      allTrainsProjected,
      timetableItems?.length ?? 0,
      conflicts,
      isConflictsLoading,
      rollingStocks,
      removeTimetableItemsWithBroadcast,
      upsertTimetableItemsWithBroadcast,
      updateTrainDepartureTimeWithBroadcast,
    ]
  );

  return results;
};

export default useScenarioData;
