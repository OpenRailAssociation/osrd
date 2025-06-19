import { useCallback, useEffect, useMemo, useState, useRef } from 'react';

import { keyBy, sortBy } from 'lodash';
import { useSelector } from 'react-redux';

import {
  osrdEditoastApi,
  type InfraWithState,
  type ScenarioResponse,
} from 'common/api/osrdEditoastApi';
import useLazyProjectTrains from 'modules/simulationResult/components/SpaceTimeChart/useLazyProjectTrains';
import formatBaseTimetableItemWithDetails from 'modules/trainschedule/helpers/formatBaseTimetableItemWithDetails';
import { getOperationalStudiesElectricalProfileSetId } from 'reducers/osrdconf/operationalStudiesConf/selectors';
import type {
  TimetableItemId,
  TimetableItem,
  PacedTrainWithPacedTrainId,
} from 'reducers/osrdconf/types';
import { getTrainIdUsedForProjection } from 'reducers/simulationResults/selectors';
import { useAppDispatch } from 'store';
import {
  formatEditoastIdToPacedTrainId,
  formatEditoastIdToTrainScheduleId,
  extractEditoastIdFromTrainScheduleId,
  isPacedTrainId,
  isTrainScheduleId,
  extractEditoastIdFromPacedTrainId,
} from 'utils/trainId';
import { mapBy } from 'utils/types';

import useAutoUpdateProjection from './useAutoUpdateProjection';
import useLazySimulateTrains from './useLazySimulateTrains';
import usePathProjection from './usePathProjection';

type ScenarioBroadcastMessage =
  | { type: 'upsertTimetableItems'; timetableItems: TimetableItem[] }
  | { type: 'removeTimetableItems'; timetableItemIds: TimetableItemId[] }
  | { type: 'updateTrainDepartureTime'; timetableItemId: TimetableItemId; newDeparture: Date };

const useScenarioData = (scenario: ScenarioResponse, infra: InfraWithState) => {
  const dispatch = useAppDispatch();
  const electricalProfileSetId = useSelector(getOperationalStudiesElectricalProfileSetId);
  const trainIdUsedForProjection = useSelector(getTrainIdUsedForProjection);

  const [timetableItems, setTimetableItems] = useState<TimetableItem[]>();

  const [putTrainScheduleById] = osrdEditoastApi.endpoints.putTrainScheduleById.useMutation();
  const [putPacedTrainById] = osrdEditoastApi.endpoints.putPacedTrainById.useMutation();

  const { data: { results: rollingStocks } = { results: null } } =
    osrdEditoastApi.endpoints.getLightRollingStock.useQuery({ pageSize: 1000 });

  const projectionPath = usePathProjection(infra);

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

  const timetableItemsById = useMemo(() => mapBy(timetableItems, 'id'), [timetableItems]);

  const {
    projectedTrainsById,
    allTrainsProjected,
    projectTimetableItems,
    removeProjectedTimetableItems,
    updateTimetableItemDepartureTime,
  } = useLazyProjectTrains({
    infraId: scenario.infra_id,
    electricalProfileSetId,
    path: projectionPath?.path,
  });

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
      projectTimetableItems([...summaries.keys()].map((id) => timetableItemsById.get(id)!));
    },
  });

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
    const items = (timetableItems || []).map((timetableItem) => {
      const simulatedTrain = simulatedTrainsById.get(timetableItem.id);
      return (
        simulatedTrain ?? formatBaseTimetableItemWithDetails(timetableItem, rollingStocks ?? [])
      );
    });
    return sortBy(items, 'startTime');
  }, [timetableItems, rollingStocks, simulatedTrainsById]);

  const projectedTrains = useMemo(
    () => Array.from(projectedTrainsById.values()),
    [projectedTrainsById]
  );

  const trainScheduleUsedForProjection = useMemo(
    () => (trainIdUsedForProjection ? timetableItemsById.get(trainIdUsedForProjection) : undefined),
    [trainIdUsedForProjection, timetableItems]
  );

  const timetableItemIds = useMemo(
    () => timetableItems?.map((item) => item.id) ?? [],
    [timetableItems]
  );

  useAutoUpdateProjection(infra, timetableItemIds, timetableItemsWithDetails);

  // first load of the summaries
  useEffect(() => {
    if (timetableItems && infra.state === 'CACHED' && simulatedTrainsById.size === 0) {
      simulateTimetableItems(timetableItems);
    }
  }, [timetableItems, infra.state, simulatedTrainsById]);

  const broadcastChannel = useRef<BroadcastChannel>();

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

  /** Update only departure time of a timetable item */
  const updateTrainDepartureTime = useCallback(
    async (timetableItemId: TimetableItemId, newDeparture: Date) => {
      const timetableItem = timetableItems?.find((item) => item.id === timetableItemId);

      if (!timetableItem) {
        throw new Error('Item non trouvé');
      }

      let updateTimetableItem: TimetableItem | undefined;

      if (isTrainScheduleId(timetableItemId)) {
        const editoastTrainId = extractEditoastIdFromTrainScheduleId(timetableItemId);

        const trainScheduleResponse = await putTrainScheduleById({
          id: editoastTrainId,
          trainScheduleForm: {
            ...timetableItem,
            start_time: newDeparture.toISOString(),
          },
        }).unwrap();

        updateTimetableItem = {
          ...trainScheduleResponse,
          id: formatEditoastIdToTrainScheduleId(trainScheduleResponse.id),
        };
      }

      if (isPacedTrainId(timetableItemId)) {
        const editoastPacedTrainId = extractEditoastIdFromPacedTrainId(timetableItemId);

        try {
          await putPacedTrainById({
            id: editoastPacedTrainId,
            body: {
              ...(timetableItem as PacedTrainWithPacedTrainId),
              start_time: newDeparture.toISOString(),
            },
          });

          updateTimetableItem = {
            ...timetableItem,
            start_time: newDeparture.toISOString(),
          };
        } catch (error) {
          console.error('Error updating paced train:', error);
        }
      }

      if (!updateTimetableItem) {
        throw new Error('Item non mis à jour');
      }

      setTimetableItems((prev) => {
        const newTrainSchedulesById = {
          ...keyBy(prev, 'id'),
          ...keyBy([updateTimetableItem], 'id'),
        };
        return sortBy(Object.values(newTrainSchedulesById), 'start_time');
      });

      simulateTimetableItems([updateTimetableItem]);
      updateTimetableItemDepartureTime(timetableItemId, newDeparture);

      // fetch conflicts
      refetchConflicts();
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
                totalTrains: timetableItems?.length ?? 0,
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
      timetableItems?.length ?? 0,
      conflicts,
      removeTimetableItemsWithBroadcast,
      upsertTimetableItemsWithBroadcast,
      updateTrainDepartureTimeWithBroadcast,
    ]
  );

  return results;
};

export default useScenarioData;
