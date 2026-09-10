import { useCallback } from 'react';

import { useScenarioContext } from 'applications/operationalStudies/hooks/useScenarioContext';
import { useTimetableContext } from 'applications/operationalStudies/hooks/useTimetableContext';
import type { PacedTrain } from 'applications/operationalStudies/types';
import {
  buildOccurrenceExceptionData,
  updatePacedTrainExceptionsList,
} from 'applications/operationalStudies/views/Scenario/components/ManageTrainSchedule/helpers/buildPacedTrainException';
import formatMargin from 'applications/operationalStudies/views/Scenario/components/ManageTrainSchedule/helpers/formatMargin';
import { formatTrainScheduleWithDetailsToTrainSchedule } from 'applications/operationalStudies/views/Scenario/components/ManageTrainSchedule/helpers/formatTrainSchedulePayload';
import {
  osrdEditoastApi,
  type TrainSchedule,
  type PathItem,
  type ReceptionSignal,
  type ScheduleItem,
  type TrainScheduleResponse,
} from 'common/api/osrdEditoastApi';
import computeBasePathStep from 'modules/trainSchedule/helpers/computeBasePathStep';
import {
  getOccurrenceTrainName,
  isPacedTrainBase,
  isPacedTrainWithDetails,
} from 'modules/trainSchedule/helpers/pacedTrain';
import { syncOccurrenceException } from 'modules/trainSchedule/helpers/updateTrainScheduleHelpers';
import type { TrainScheduleWithDetails } from 'modules/trainSchedule/types';
import type { OccurrenceId, TrainScheduleId, Train } from 'reducers/osrdconf/types';
import { useAppDispatch } from 'store';
import { removeElementAtIndex, replaceElementAtIndex } from 'utils/array';
import { Duration, type StartTime, startTimeToMs } from 'utils/duration';
import {
  extractEditoastIdFromTrainScheduleId,
  extractTrainScheduleIdFromOccurrenceId,
  isOccurrenceId,
  isTrainScheduleId,
} from 'utils/trainId';

import { MarginUnit } from '../consts';
import { cascadeArrivals } from '../helpers/arrivalCascade';
import {
  upsertPathStep,
  applyScheduleEdit,
  scheduleStateToApiFields,
  buildUpdatedOccurrence,
  buildPowerRestrictionsFromRows,
  insertScheduleItemInOrder,
} from '../helpers/cellUpdate';
import { propagateStopDuration } from '../helpers/stopDurationPropagation';
import { propagateTime } from '../helpers/timePropagation';
import { getTruncatedToSecondStartTime } from '../helpers/utils';
import type {
  ArrivalUpdate,
  CellUpdate,
  DepartureUpdate,
  OptimisticEdit,
  PowerRestrictionUpdate,
  ReceptionSignalUpdate,
  RequestedMarginUpdate,
  StopDurationUpdate,
  PropagationMode,
  StopPropagationMode,
  MarginValue,
  TimesStopsRowNew,
  UpdateCellStatus,
  BatchTimesUpdate,
  RequestedTimeField,
} from '../types';

/** The train fields an edit can change. */
type TrainPatch = Partial<
  Pick<TrainSchedule, 'path' | 'schedule' | 'margins' | 'power_restrictions' | 'start_time'>
>;

const formatRequestedMargin = (requestedMargin: MarginValue | null) => {
  if (!requestedMargin) return null;

  const { value, unit } = requestedMargin;
  if (unit === MarginUnit.percent) return `${value}%`;
  if (unit === MarginUnit.minPer100km) return `${value}min/100km`;
  return null;
};

/**
 * Hook that provides a callback to update times/stops cell values.
 * When a cell is edited (TimeCell or DurationCell), this callback:
 * 1. Updates the train's schedule array
 * 2. Calls the API to persist the change
 * 3. Triggers simulation re-run via upsertTrainSchedules
 *
 * When editing an occurrence:
 * - Finds the parent PacedTrain from trainSchedulesWithDetails
 * - Generates or updates the exception for this occurrence
 * - Updates the PacedTrain with the new exception
 * - Calls upsertTrainSchedules to trigger re-simulation
 */
const useUpdateTimesStopsTable = (
  selectedTrain: Train,
  allRows: TimesStopsRowNew[],
  trainSchedulesWithDetails: TrainScheduleWithDetails[]
) => {
  const dispatch = useAppDispatch();
  const { timetableId, scenario } = useScenarioContext();
  const { upsertTrainSchedules } = useTimetableContext();
  const [updateTrainSchedule] = osrdEditoastApi.endpoints.putTrainSchedulesById.useMutation();

  const computeUpdatedMargins = useCallback(
    (updatedPath: PathItem[], requestedMargin: MarginValue | null, pathStepId: string) => {
      const baseTrainInputs: Pick<TrainSchedule, 'path' | 'schedule' | 'margins'> = {
        path: updatedPath,
        schedule: selectedTrain.schedule,
        margins: selectedTrain.margins,
      };

      const updatedPathSteps = updatedPath.map((_, index) =>
        computeBasePathStep(baseTrainInputs, index)
      );
      const targetedStep = updatedPathSteps.find((step) => step.id === pathStepId);

      if (!targetedStep) return selectedTrain.margins;

      targetedStep.theoreticalMargin = formatRequestedMargin(requestedMargin) ?? undefined;
      return formatMargin(updatedPathSteps);
    },
    [selectedTrain]
  );

  const persistTrain = async (train: TrainScheduleResponse): Promise<'updated'> => {
    await updateTrainSchedule({
      id: train.id,
      trainSchedule: train,
    }).unwrap();
    upsertTrainSchedules([train]);
    return 'updated';
  };

  const computeMarginUpdate = (update: RequestedMarginUpdate): TrainPatch => {
    const { pathStepId, updatedPath } = upsertPathStep(update.row, selectedTrain.path, allRows);
    return {
      path: updatedPath,
      margins: computeUpdatedMargins(updatedPath, update.value, pathStepId),
    };
  };

  /** A stop is always required to edit a reception signal, so its schedule item must exist. */
  const computeReceptionSignalUpdate = (update: ReceptionSignalUpdate): TrainPatch | undefined => {
    const { pathStepId, updatedPath } = upsertPathStep(update.row, selectedTrain.path, allRows);
    const currentSchedule = selectedTrain.schedule ?? [];
    const existingItemIndex = currentSchedule.findIndex((item) => item.at === pathStepId);
    if (existingItemIndex < 0) return undefined;

    return {
      path: updatedPath,
      schedule: replaceElementAtIndex(currentSchedule, existingItemIndex, {
        ...currentSchedule[existingItemIndex],
        reception_signal: update.value,
      }),
    };
  };

  const computeTimesUpdate = (
    update: ArrivalUpdate | DepartureUpdate | StopDurationUpdate
  ): TrainPatch | undefined => {
    const propagatedResult =
      update.field === 'stopDuration'
        ? propagateStopDuration(update, selectedTrain, scenario.timetable_type)
        : propagateTime(update, selectedTrain, scenario.timetable_type);
    if (propagatedResult)
      return {
        path: propagatedResult.updatedPath,
        // The days must be right before saving
        schedule: cascadeArrivals({
          schedule: propagatedResult.updatedSchedule,
          path: propagatedResult.updatedPath,
          fromPathIndex: 1,
        }),
        start_time: startTimeToMs(propagatedResult.updatedStartTime),
      };

    const { pathStepId, updatedPath } = upsertPathStep(update.row, selectedTrain.path, allRows);
    const currentSchedule = selectedTrain.schedule ?? [];
    const existingItemIndex = currentSchedule.findIndex((item) => item.at === pathStepId);
    const isOrigin = pathStepId === updatedPath[0].id;

    // Convert CellUpdate to OptimisticEdit (stopDuration: number → Duration)
    let edit: Exclude<OptimisticEdit, { field: 'powerRestriction' }>;
    if (update.field === 'stopDuration') {
      edit = {
        field: 'stopDuration',
        value: update.value !== null ? new Duration({ seconds: update.value }) : null,
      };
    } else {
      edit = update;
    }

    const newState = applyScheduleEdit(
      { arrival: update.row.requestedArrival, stop: update.row.stopDuration },
      edit
    );

    const startTime = getTruncatedToSecondStartTime(selectedTrain, scenario.timetable_type);
    const { arrival: newArrival, stop_for: newStopFor } = scheduleStateToApiFields(
      newState,
      startTime
    );

    const shouldRemove = newArrival === null && newStopFor === null;
    let updatedSchedule: ScheduleItem[];

    if (shouldRemove) {
      // Both fields cleared: remove the schedule item entirely
      if (existingItemIndex < 0) return undefined;
      updatedSchedule = removeElementAtIndex(currentSchedule, existingItemIndex);
    } else if (existingItemIndex >= 0) {
      // Update existing schedule item
      updatedSchedule = replaceElementAtIndex(currentSchedule, existingItemIndex, {
        ...currentSchedule[existingItemIndex],
        arrival: isOrigin ? null : newArrival,
        stop_for: newStopFor,
      });
    } else {
      // Insert new schedule item in path order
      const newItem: ScheduleItem = {
        at: pathStepId,
        arrival: isOrigin ? null : newArrival,
        stop_for: newStopFor,
      };
      updatedSchedule = insertScheduleItemInOrder(currentSchedule, newItem, updatedPath);
    }

    return {
      path: updatedPath,
      // The days must be right before saving
      schedule: cascadeArrivals({ schedule: updatedSchedule, path: updatedPath, fromPathIndex: 1 }),
      // The offsets above are rebuilt from the truncated start time, so it must be saved with them.
      start_time: startTimeToMs(startTime),
    };
  };

  /**
   * Compute the updated path and rebuilt power_restrictions array when a power restriction
   * cell is edited. The edited row is upserted as a path step (so a new restriction can
   * be set on a non-path-step waypoint).
   */
  const computePowerRestrictionUpdate = (update: PowerRestrictionUpdate): TrainPatch => {
    const { pathStepId, updatedPath } = upsertPathStep(update.row, selectedTrain.path, allRows);
    const modifiedRows = allRows.map((r) =>
      r.id === update.row.id ? { ...r, pathStepId, powerRestriction: update.value } : r
    );
    return { path: updatedPath, power_restrictions: buildPowerRestrictionsFromRows(modifiedRows) };
  };

  /** Fill several rows at once with the times computed by the simulation. */
  const computeBatchTimesUpdate = (update: BatchTimesUpdate): TrainPatch => {
    let updatedSchedule = selectedTrain.schedule ?? [];
    let currentPath = selectedTrain.path;

    const startTime = getTruncatedToSecondStartTime(selectedTrain, scenario.timetable_type);

    for (const row of update.rows) {
      const { pathStepId, updatedPath: updatedPathForRow } = upsertPathStep(
        row,
        currentPath,
        allRows
      );
      currentPath = updatedPathForRow;
      const existingItemIndex = updatedSchedule.findIndex((item) => item.at === pathStepId);

      const edit: Exclude<OptimisticEdit, { field: 'powerRestriction' }> =
        update.field === 'requestedArrival'
          ? {
              field: 'requestedArrival',
              value: row.computedArrival,
            }
          : {
              field: 'requestedDeparture',
              value: row.computedDeparture,
            };

      const newState = applyScheduleEdit(
        { arrival: row.requestedArrival, stop: row.stopDuration },
        edit
      );

      const { arrival: newArrival, stop_for: newStopFor } = scheduleStateToApiFields(
        newState,
        startTime
      );

      if (existingItemIndex >= 0) {
        // Update existing schedule item
        updatedSchedule = replaceElementAtIndex(updatedSchedule, existingItemIndex, {
          ...updatedSchedule[existingItemIndex],
          arrival: newArrival,
          stop_for: newStopFor,
        });
      } else {
        // Insert new schedule item in path order
        const newItem: ScheduleItem = { at: pathStepId };
        if (newArrival !== null) newItem.arrival = newArrival;
        if (newStopFor !== null) newItem.stop_for = newStopFor;
        updatedSchedule = insertScheduleItemInOrder(updatedSchedule, newItem, currentPath);
      }
    }

    return {
      path: currentPath,
      schedule: updatedSchedule,
      // The offsets above are rebuilt from the truncated start time, so it must be saved with them.
      start_time: startTimeToMs(startTime),
    };
  };

  /** Compute the updated train fields for a cell update. */
  const computeTrainUpdate = useCallback(
    (update: CellUpdate): TrainPatch | undefined => {
      if ('rows' in update) return computeBatchTimesUpdate(update);
      if (update.field === 'powerRestriction') return computePowerRestrictionUpdate(update);
      if (update.field === 'requestedTheoreticalMargin') return computeMarginUpdate(update);
      if (update.field === 'receptionSignal') return computeReceptionSignalUpdate(update);
      return computeTimesUpdate(update);
    },
    [selectedTrain, allRows, computeUpdatedMargins, scenario.timetable_type]
  );

  /**
   * Handle update when the selected train is an occurrence of a PacedTrain.
   * Uses exception-specific endpoints instead of updating the full paced train.
   */
  const updateOccurrence = useCallback(
    async (occurrenceId: OccurrenceId, update: CellUpdate): Promise<UpdateCellStatus> => {
      const trainScheduleId = extractEditoastIdFromTrainScheduleId(
        extractTrainScheduleIdFromOccurrenceId(occurrenceId)
      );
      const originalPacedTrainWithDetails = trainSchedulesWithDetails.find(
        (trainSchedule) => trainSchedule.id === trainScheduleId
      );

      if (
        !originalPacedTrainWithDetails ||
        !isPacedTrainWithDetails(originalPacedTrainWithDetails)
      ) {
        throw new Error(`Parent PacedTrain not found for occurrence: ${occurrenceId}`);
      }

      const formattedPacedTrain = formatTrainScheduleWithDetailsToTrainSchedule(
        originalPacedTrainWithDetails
      );
      if (!isPacedTrainBase(formattedPacedTrain)) {
        throw new Error('Formatted PacedTrain is missing paced field');
      }
      // formatTrainScheduleWithDetailsToTrainSchedulePayload intentionally strips exceptions
      // (they have dedicated endpoints). Restore the actual list from trainSchedulesWithDetails
      // so lookups, diff computation, and local state updates see the full current state.
      const originalPacedTrain: PacedTrain = {
        ...formattedPacedTrain,
        paced: {
          ...formattedPacedTrain.paced,
          exceptions: originalPacedTrainWithDetails.paced.exceptions,
        },
      };

      // selectedTrain.train_name is the paced train's BASE name, but the
      // exception diff expects the occurrence's computed name.
      const occurrenceTrainName = getOccurrenceTrainName(originalPacedTrain, occurrenceId);

      const patch = computeTrainUpdate(update);
      if (!patch) return 'skipped';

      const updatedOccurrence: TrainSchedule = {
        ...buildUpdatedOccurrence(selectedTrain, occurrenceTrainName),
        ...patch,
      };

      const { generatedException, existingException, occurrenceIndex } =
        buildOccurrenceExceptionData(originalPacedTrain, updatedOccurrence, occurrenceId);

      const finalException = await syncOccurrenceException(
        dispatch,
        generatedException,
        existingException,
        occurrenceIndex,
        trainScheduleId,
        timetableId
      );

      const updatedExceptions = updatePacedTrainExceptionsList(
        originalPacedTrain.paced.exceptions,
        finalException,
        occurrenceId
      );

      return persistTrain({
        ...originalPacedTrain,
        id: trainScheduleId,
        train_schedule_set_id: originalPacedTrainWithDetails.train_schedule_set_id,
        paced: { ...originalPacedTrain.paced, exceptions: updatedExceptions },
      });
    },
    [selectedTrain, trainSchedulesWithDetails, computeTrainUpdate, timetableId, dispatch]
  );

  /**
   * Handle update when the selected train is a TrainSchedule (not an occurrence).
   */
  const handleUpdateTrainSchedule = useCallback(
    async (trainId: TrainScheduleId, update: CellUpdate): Promise<UpdateCellStatus> => {
      const patch = computeTrainUpdate(update);
      if (!patch) return 'skipped';

      return persistTrain({
        ...selectedTrain,
        id: extractEditoastIdFromTrainScheduleId(trainId),
        ...patch,
      });
    },
    [selectedTrain, computeTrainUpdate, updateTrainSchedule]
  );

  /**
   * Main update function that routes to the appropriate handler.
   */
  const updateCell = useCallback(
    async (update: CellUpdate): Promise<UpdateCellStatus> => {
      const { id: trainId } = selectedTrain;

      if (isOccurrenceId(trainId)) {
        return updateOccurrence(trainId, update);
      } else if (isTrainScheduleId(trainId)) {
        return handleUpdateTrainSchedule(trainId, update);
      } else {
        throw new Error('TrainSchedules are not handled anymore.');
      }
    },
    [selectedTrain, updateOccurrence, handleUpdateTrainSchedule]
  );

  // Functions are included in deps (exception to the project convention) to propagate
  // allRows updates through the entire callback chain.
  const updateArrival = useCallback(
    (row: TimesStopsRowNew, arrival: StartTime | null, propagationMode: PropagationMode) =>
      updateCell({
        row,
        field: 'requestedArrival',
        value: arrival,
        propagationMode,
      }),
    [updateCell]
  );

  const updateStopDuration = useCallback(
    (row: TimesStopsRowNew, durationSeconds: number | null, propagationMode: StopPropagationMode) =>
      updateCell({ row, field: 'stopDuration', value: durationSeconds, propagationMode }),
    [updateCell]
  );

  const updateDeparture = useCallback(
    (row: TimesStopsRowNew, departure: StartTime | null, propagationMode: PropagationMode) =>
      updateCell({
        row,
        field: 'requestedDeparture',
        value: departure,
        propagationMode,
      }),
    [updateCell]
  );

  const updateReceptionSignal = useCallback(
    (row: TimesStopsRowNew, receptionSignal: ReceptionSignal | undefined) =>
      updateCell({ row, field: 'receptionSignal', value: receptionSignal }),
    [updateCell]
  );

  const updateRequestedMargin = useCallback(
    (row: TimesStopsRowNew, requestedTheoreticalMargin: MarginValue | null) =>
      updateCell({
        row,
        field: 'requestedTheoreticalMargin',
        value: requestedTheoreticalMargin,
      }),
    [updateCell]
  );

  const updatePowerRestrictions = useCallback(
    (row: TimesStopsRowNew, powerRestriction: string | null) =>
      updateCell({ row, field: 'powerRestriction', value: powerRestriction }),
    [updateCell]
  );

  const updateMultipleTimes = useCallback(
    (rows: TimesStopsRowNew[], field: RequestedTimeField) => updateCell({ rows, field }),
    [updateCell]
  );

  return {
    updateArrival,
    updateStopDuration,
    updateDeparture,
    updateReceptionSignal,
    updateRequestedMargin,
    updatePowerRestrictions,
    updateMultipleTimes,
  };
};

export default useUpdateTimesStopsTable;
