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
import { formatTrainScheduleWithDetails } from 'modules/trainSchedule/helpers/formatTrainScheduleWithDetails';
import { computeHourlyTimetableDuration } from 'modules/trainSchedule/helpers/hourlyTimetable';
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
import { Duration } from 'utils/duration';
import {
  extractEditoastIdFromTrainScheduleId,
  extractTrainScheduleIdFromOccurrenceId,
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

/**
 * In 'all' mode the whole paced train moves, so every start_time exception is shifted by the same
 * offset as the model departure. Returns undefined when there is nothing to shift.
 */
function computeShiftedExceptions(
  trainSchedule: TrainScheduleResponse,
  newDeparture: Date,
  panelSelectionMode?: PanelSelectionMode
): PacedTrainException[] | undefined {
  if (panelSelectionMode !== 'all' || !trainSchedule.paced) return undefined;
  const offset = Duration.subtractDate(newDeparture, new Date(trainSchedule.start_time));
  return shiftPacedExceptions(trainSchedule.paced.exceptions, offset);
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
    const trainSchedulesResult = dispatch(
      osrdEditoastApi.endpoints.getAllTimetableByIdTrainSchedules.initiate({
        timetableId: scenario.timetable_id,
      })
    );

    const fetchTrainSchedules = async () => {
      const trainSchedulesResponse = (await trainSchedulesResult.unwrap()) ?? [];

      setTrainSchedules(sortBy(trainSchedulesResponse, 'start_time'));
    };

    fetchTrainSchedules();

    return () => {
      trainSchedulesResult.unsubscribe();
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
    timetableType: scenario.timetable_type,
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
      return formatTrainScheduleWithDetails(trainSchedule, scenario.timetable_type, rollingStock);
    });
    return sortBy(trains, ['startTime', 'name', 'id']);
  }, [trainSchedules, rollingStocksByName, simulatedTrainsById, scenario.timetable_type]);

  const projectedTrains = useMemo(
    () => Array.from(projectedTrainsById.values()),
    [projectedTrainsById]
  );

  const hourlyTimetableDuration = useMemo(
    () =>
      scenario.timetable_type === 'HOURLY'
        ? computeHourlyTimetableDuration(trainSchedules ?? [])
        : undefined,
    [scenario.timetable_type, trainSchedules]
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
    (trainScheduleId: number, newDeparture: Date, panelSelectionMode?: PanelSelectionMode) => {
      const trainSchedule = trainSchedules?.find((train) => train.id === trainScheduleId);
      const shiftedExceptions = trainSchedule
        ? computeShiftedExceptions(trainSchedule, newDeparture, panelSelectionMode)
        : undefined;

      setTrainSchedules((prev) => {
        const prevTrainSchedule = prev?.find((train) => train.id === trainScheduleId);
        if (!prevTrainSchedule) {
          return prev;
        }
        const updatedTrainSchedule = withPacedExceptions(
          { ...prevTrainSchedule, start_time: newDeparture.getTime() },
          shiftedExceptions
        );
        return upsertAndSort(prev, updatedTrainSchedule);
      });

      // Pass shiftedExceptions to both so that exception occurrences (timetable + space-time chart)
      // immediately reflect the shifted start_time without waiting for a full re-simulation.
      updateSimulatedTrainScheduleDepartureTime(trainScheduleId, newDeparture, shiftedExceptions);
      updateProjectedTrainScheduleDepartureTime(trainScheduleId, newDeparture, shiftedExceptions);
    },
    [trainSchedules]
  );

  /** Update paced train exceptions in local state without re-simulating. Used after drag-created exceptions. */
  const upsertTrainScheduleExceptions = useCallback(
    (trainScheduleId: number, updatedExceptions: PacedTrainException[]) => {
      setTrainSchedules((prev) => {
        const train = prev?.find((t) => t.id === trainScheduleId);
        if (!train?.paced) return prev;
        const updated: TrainScheduleResponse = {
          ...train,
          paced: { ...train.paced, exceptions: updatedExceptions },
        };
        return upsertAndSort(prev, updated);
      });
      updateSimulatedTrainExceptions(trainScheduleId, updatedExceptions);
      updateProjectedTrainExceptions(trainScheduleId, updatedExceptions);
    },
    []
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
      const editoastId = extractEditoastIdFromTrainScheduleId(
        isOccurrenceId(draggedTrainId)
          ? extractTrainScheduleIdFromOccurrenceId(draggedTrainId)
          : draggedTrainId
      );
      const trainSchedule = trainSchedules?.find((train) => train.id === editoastId);
      if (!trainSchedule) {
        throw new Error(`Train schedule "${editoastId}" not found`);
      }

      // 'single' mode: create / update / delete the dragged occurrence's exception. We reuse the
      // same diff helpers as the times-stops table, so the "exception re-aligned on the model"
      // detection (which drops the start_time override) stays consistent across the app.
      if (
        panelSelectionMode === 'single' &&
        isOccurrenceId(draggedTrainId) &&
        isPacedTrain(trainSchedule)
      ) {
        const existingException = findExceptionWithOccurrenceId(
          trainSchedule.paced.exceptions,
          draggedTrainId
        );
        const { paced: _paced, ...occurrenceBaseTrain } = trainSchedule;
        const updatedOccurrence: TrainSchedule = {
          ...extractOccurrenceDetailsFromPacedTrain(occurrenceBaseTrain, existingException),
          train_name: getOccurrenceTrainName(trainSchedule, draggedTrainId),
          start_time: newDeparture.getTime(),
        };

        const {
          generatedException,
          existingException: exceptionToSync,
          occurrenceIndex,
        } = buildOccurrenceExceptionData(trainSchedule, updatedOccurrence, draggedTrainId);
        const finalException = await syncOccurrenceException(
          dispatch,
          generatedException,
          exceptionToSync,
          occurrenceIndex,
          editoastId,
          timetableId
        );
        const updatedExceptions = updatePacedTrainExceptionsList(
          trainSchedule.paced.exceptions,
          finalException,
          draggedTrainId
        );
        upsertTrainScheduleExceptions(editoastId, updatedExceptions);
        return;
      }

      // 'all' mode: the whole paced train moves — shift every start_time exception by the same offset.
      const shiftedExceptions = computeShiftedExceptions(
        trainSchedule,
        newDeparture,
        panelSelectionMode
      );

      // Update the model start_time. The train schedule PUT ignores paced.exceptions, so shifted
      // exceptions are persisted through their own endpoint below.
      await updateTrainSchedule({
        id: trainSchedule.id,
        trainSchedule: { ...trainSchedule, start_time: newDeparture.getTime() },
      }).unwrap();

      if (shiftedExceptions) {
        const exceptionsToShift = shiftedExceptions.filter(
          // filter out null/undefined ids, which can happen if the exception is deleted because it was re-aligned on the model.
          (exc) => exc.start_time && exc.id !== null && exc.id !== undefined
        );
        await updateExceptions(dispatch, exceptionsToShift, trainSchedule.id);
      }

      setTrainScheduleDepartureTime(editoastId, newDeparture, panelSelectionMode);
    },
    [trainSchedules, dispatch, timetableId, upsertTrainScheduleExceptions]
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
      const editoastId = extractEditoastIdFromTrainScheduleId(
        isOccurrenceId(draggedTrainId)
          ? extractTrainScheduleIdFromOccurrenceId(draggedTrainId)
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
      trainSchedulesById,
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
      hourlyTimetableDuration,
      removeTrainSchedules: removeTrainSchedulesWithBroadcast,
      upsertTrainSchedules: upsertTrainSchedulesWithBroadcast,
      updateTrainScheduleDepartureTime: updateTrainScheduleDepartureTimeWithBroadcast,
      selectedTrainScheduleIds,
      setSelectedTrainScheduleIds,
    }),
    [
      trainSchedulesWithDetails,
      trainSchedulesById,
      projectionPath,
      projectedTrains,
      allTrainsProjected,
      trainSchedules?.length ?? 0,
      conflicts,
      isConflictsLoading,
      hourlyTimetableDuration,
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
