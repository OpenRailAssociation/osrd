import { useCallback, useEffect, useMemo, useState, useRef } from 'react';

import { skipToken } from '@reduxjs/toolkit/query';
import { keyBy, sortBy } from 'lodash';

import {
  buildOccurrenceExceptionData,
  updatePacedTrainExceptionsList,
} from 'applications/operationalStudies/views/Scenario/components/ManageTrainSchedule/helpers/buildPacedTrainException';
import {
  osrdEditoastApi,
  type PacedTrainException,
  type ScenarioWithDetails,
  type TrainSchedule,
  type TrainScheduleResponse,
} from 'common/api/osrdEditoastApi';
import { useRollingStockContext } from 'common/RollingStockContext';
import type { PanelSelectionMode } from 'modules/simulationResult/components/SpaceTimeChartWrapper/CurveSelectionSidePanel';
import useLazyProjectTrains from 'modules/simulationResult/components/SpaceTimeChartWrapper/useLazyProjectTrains';
import { formatPacedTrainWithDetails } from 'modules/trainSchedule/helpers/formatTrainScheduleWithDetails';
import {
  extractOccurrenceDetailsFromPacedTrain,
  findExceptionWithOccurrenceId,
  getOccurrenceTrainName,
  isPacedTrain,
  shiftPacedExceptions,
  withPacedExceptions,
} from 'modules/trainSchedule/helpers/pacedTrain';
import {
  syncOccurrenceException,
  updateExceptions,
} from 'modules/trainSchedule/helpers/updateTrainScheduleHelpers';
import type { TrainId } from 'reducers/osrdconf/types';
import { useAppDispatch } from 'store';
import {
  extractEditoastIdFromPacedTrainId,
  extractPacedTrainIdFromOccurrenceId,
  isOccurrenceId,
} from 'utils/trainId';
import { mapBy } from 'utils/types';

import useAutoSelectTrainIds from './useAutoSelectTrainIds';
import useLazySimulateTrains from './useLazySimulateTrains';
import usePathProjection from './usePathProjection';
import { useScenarioContext } from './useScenarioContext';

type ScenarioBroadcastMessage =
  | { type: 'upsertTrainSchedules'; trainSchedules: TrainScheduleResponse[] }
  | { type: 'removeTrainSchedules'; trainScheduleIds: number[] }
  | { type: 'setTrainScheduleDepartureTime'; trainScheduleId: number; newDeparture: Date };

function upsertAndSort(
  prev: TrainScheduleResponse[] | undefined,
  updates: TrainScheduleResponse | TrainScheduleResponse[]
): TrainScheduleResponse[] {
  const arr = Array.isArray(updates) ? updates : [updates];
  return sortBy(Object.values({ ...keyBy(prev, 'id'), ...keyBy(arr, 'id') }), 'start_time');
}

const useScenarioData = (scenario: ScenarioWithDetails, infraId: number, timetableId: number) => {
  const dispatch = useAppDispatch();

  const [trainSchedules, setTrainSchedules] = useState<TrainScheduleResponse[]>();
  const trainSchedulesById = useMemo(() => mapBy(trainSchedules, 'id'), [trainSchedules]);
  const [selectedTrainScheduleIds, setSelectedTrainScheduleIds] = useState<number[]>([]);

  const [updateTrainSchedule] = osrdEditoastApi.endpoints.putTrainSchedulesById.useMutation();

  const { workerStatus } = useScenarioContext();
  const { rollingStocks, rollingStockMap: rollingStocksByName } = useRollingStockContext();

  const projectionPath = usePathProjection(infraId, trainSchedulesById);

  useEffect(() => {
    const pacedTrainsResult = dispatch(
      osrdEditoastApi.endpoints.getAllTimetableByIdTrainSchedules.initiate({
        timetableId: scenario.timetable_id,
      })
    );

    const fetchTrainSchedules = async () => {
      const pacedTrains = (await pacedTrainsResult.unwrap()) ?? [];

      setTrainSchedules(sortBy(pacedTrains, 'start_time'));
    };

    fetchTrainSchedules();

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
    updateProjectedTrainExceptions,
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
    isTrainSimulationLoading,
    removeSimulatedTrainSchedules,
    updateSimulatedTrainScheduleDepartureTime,
    updateSimulatedTrainExceptions,
  } = useLazySimulateTrains({
    infraId,
    timetableId,
    electricalProfileSetId: scenario.electrical_profile_set_id,
    rollingStocks,
    onProgress: (summaries) => {
      projectTrainSchedules([...summaries.keys()].map((id) => trainSchedulesById.get(id)!));
    },
  });

  const isReadyToFetchConflicts =
    trainSchedules &&
    simulatedTrainsById.size === trainSchedules.length &&
    !isTrainSimulationLoading;

  // TODO Paced trains : adapt this to handle paced trains in the conflicts issue
  // TODO: investigate why RTK Query returns undefined here despite isFetching and isUninitialized being false and the API always returning a list
  const {
    data: conflictsData,
    isUninitialized,
    isFetching,
  } = osrdEditoastApi.endpoints.getTimetableByIdConflicts.useQuery(
    isReadyToFetchConflicts ? { id: scenario.timetable_id, infraId: scenario.infra_id } : skipToken
  );
  const conflicts = useMemo(() => conflictsData ?? [], [conflictsData]);

  const isConflictsLoading = isUninitialized || isFetching;

  const trainSchedulesWithDetails = useMemo(() => {
    const trains = (trainSchedules || []).map((trainSchedule) => {
      const simulatedTrain = simulatedTrainsById.get(trainSchedule.id);
      if (simulatedTrain) return simulatedTrain;
      const rollingStock = rollingStocksByName.get(trainSchedule.rolling_stock_name);
      return formatPacedTrainWithDetails(trainSchedule, rollingStock);
    });
    return sortBy(trains, ['startTime', 'name', 'id']);
  }, [trainSchedules, rollingStocksByName, simulatedTrainsById]);

  const projectedTrains = useMemo(
    () => Array.from(projectedTrainsById.values()),
    [projectedTrainsById]
  );

  useAutoSelectTrainIds(trainSchedules ? trainSchedulesWithDetails : undefined);

  // first load of the summaries
  useEffect(() => {
    if (trainSchedules && workerStatus === 'READY' && simulatedTrainsById.size === 0) {
      simulateTrainSchedules(trainSchedules);
    }
  }, [trainSchedules, workerStatus, simulatedTrainsById]);

  const broadcastChannel = useRef<BroadcastChannel>(null);

  const broadcastScenarioMessage = (msg: ScenarioBroadcastMessage) => {
    broadcastChannel.current?.postMessage(msg);
  };

  const upsertTrainSchedules = useCallback((trainSchedulesToUpsert: TrainScheduleResponse[]) => {
    setTrainSchedules((prev) => upsertAndSort(prev, trainSchedulesToUpsert));

    removeSimulatedTrainSchedules(trainSchedulesToUpsert.map((trainSchedule) => trainSchedule.id));
    removeProjectedTrainSchedules(trainSchedulesToUpsert.map((trainSchedule) => trainSchedule.id));
    simulateTrainSchedules(trainSchedulesToUpsert);
  }, []);

  const removeTrainSchedules = useCallback((_trainSchedulesToRemove: number[]) => {
    setTrainSchedules((prev) => {
      const prevTrainSchedulesById = mapBy(prev, 'id');
      _trainSchedulesToRemove.forEach((trainScheduleId) => {
        prevTrainSchedulesById.delete(trainScheduleId);
      });
      return Array.from(prevTrainSchedulesById.values());
    });

    setSelectedTrainScheduleIds((prevSelected) =>
      prevSelected.filter((id) => !_trainSchedulesToRemove.includes(id))
    );

    removeSimulatedTrainSchedules(_trainSchedulesToRemove);
    removeProjectedTrainSchedules(_trainSchedulesToRemove);
  }, []);

  const setTrainScheduleDepartureTime = useCallback(
    (trainScheduleId: number, newDeparture: Date, _panelSelectionMode?: PanelSelectionMode) => {
      setTrainSchedules((prev) => {
        const prevTrainSchedule = prev?.find((train) => train.id === trainScheduleId);
        if (!prevTrainSchedule) {
          return prev;
        }
        const updatedTrainSchedule = {
          ...prevTrainSchedule,
          start_time: newDeparture.getTime(),
        };
        return upsertAndSort(prev, updatedTrainSchedule);
      });

      updateSimulatedTrainScheduleDepartureTime(trainScheduleId, newDeparture);
      updateProjectedTrainScheduleDepartureTime(trainScheduleId, newDeparture);
    },
    [trainSchedules]
  );

  /**
   * Move a train (or one of its occurrences) to a new departure time, depending on the panel mode:
   * - 'single': create / update / delete the dragged occurrence's start_time exception
   * - 'all': shift the model and every start_time exception by the same offset
   * - 'compliant' / non-paced: shift the model departure
   */
  const updateTrainScheduleDepartureTime = useCallback(
    async (
      draggedTrainId: TrainId,
      newDeparture: Date,
      panelSelectionMode?: PanelSelectionMode
    ) => {
      const editoastId = extractEditoastIdFromPacedTrainId(
        isOccurrenceId(draggedTrainId)
          ? extractPacedTrainIdFromOccurrenceId(draggedTrainId)
          : draggedTrainId
      );
      const trainSchedule = trainSchedules?.find((train) => train.id === editoastId);
      if (!trainSchedule) {
        throw new Error(`Train schedule "${editoastId}" not found`);
      }

      // Update the model start_time.
      await updateTrainSchedule({
        id: trainSchedule.id,
        trainSchedule: { ...trainSchedule, start_time: newDeparture.getTime() },
      }).unwrap();

      setTrainScheduleDepartureTime(editoastId, newDeparture, panelSelectionMode);
    },
    [trainSchedules]
  );

  const upsertTrainSchedulesWithBroadcast = useCallback(
    (trainSchedulesToUpsert: TrainScheduleResponse[]) => {
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
    async (
      draggedTrainId: TrainId,
      newDeparture: Date,
      panelSelectionMode?: PanelSelectionMode
    ) => {
      await updateTrainScheduleDepartureTime(draggedTrainId, newDeparture, panelSelectionMode);
      // 'single' only changes one occurrence's exception, not the model departure: nothing to
      // broadcast as a departure-time change (other tabs reconcile via tag invalidation).
      if (panelSelectionMode === 'single') return;
      const editoastId = extractEditoastIdFromPacedTrainId(
        isOccurrenceId(draggedTrainId)
          ? extractPacedTrainIdFromOccurrenceId(draggedTrainId)
          : draggedTrainId
      );
      broadcastScenarioMessage({
        type: 'setTrainScheduleDepartureTime',
        trainScheduleId: editoastId,
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
      trainSchedules,
      projectionData: projectionPath
        ? {
            ...projectionPath,
            projectedTrains,
            projectionLoaderData: {
              allTrainsProjected,
              totalTrains: trainSchedules?.length ?? 0,
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
      trainSchedules,
      projectionPath,
      projectedTrains,
      allTrainsProjected,
      trainSchedules?.length ?? 0,
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
