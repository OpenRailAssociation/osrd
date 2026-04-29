import { useCallback } from 'react';

import { useScenarioContext } from 'applications/operationalStudies/hooks/useScenarioContext';
import type { PacedTrainWithPaced } from 'applications/operationalStudies/types';
import {
  buildOccurrenceExceptionData,
  updatePacedTrainExceptionsList,
} from 'applications/operationalStudies/views/Scenario/components/ManageTrainSchedule/helpers/buildPacedTrainException';
import formatMargin from 'applications/operationalStudies/views/Scenario/components/ManageTrainSchedule/helpers/formatMargin';
import { formatPacedTrainWithDetailsToPacedTrainPayload } from 'applications/operationalStudies/views/Scenario/components/ManageTrainSchedule/helpers/formatTrainSchedulePayload';
import {
  osrdEditoastApi,
  type TrainSchedule,
  type PathItem,
  type ReceptionSignal,
  type ScheduleItem,
} from 'common/api/osrdEditoastApi';
import computeBasePathStep from 'modules/trainSchedule/helpers/computeBasePathStep';
import {
  getOccurrenceTrainName,
  isPacedTrainBase,
  isPacedTrainWithDetails,
} from 'modules/trainSchedule/helpers/pacedTrain';
import { syncOccurrenceException } from 'modules/trainSchedule/helpers/updateTrainScheduleHelpers';
import type { TrainScheduleWithDetails } from 'modules/trainSchedule/types';
import type { OccurrenceId, PacedTrainId, TimetableItem, Train } from 'reducers/osrdconf/types';
import { useAppDispatch } from 'store';
import { removeElementAtIndex, replaceElementAtIndex } from 'utils/array';
import { Duration } from 'utils/duration';
import {
  extractEditoastIdFromPacedTrainId,
  extractPacedTrainIdFromOccurrenceId,
  isOccurrenceId,
  isPacedTrainId,
} from 'utils/trainId';

import { MarginUnit } from '../consts';
import {
  upsertPathStep,
  applyScheduleEdit,
  scheduleStateToApiFields,
  buildUpdatedOccurrence,
  buildPowerRestrictionsFromRows,
  insertScheduleItemInOrder,
} from '../helpers/cellUpdate';
import { adjustFollowingWaypointsForMidnight, propagateTime } from '../helpers/timePropagation';
import type {
  CellUpdate,
  OptimisticEdit,
  PowerRestrictionUpdate,
  PropagationMode,
  MarginValue,
  TimesStopsRowNew,
  UpdateCellStatus,
} from '../types';

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
  trainSchedulesWithDetails: TrainScheduleWithDetails[],
  upsertTrainSchedules: (trainSchedules: TimetableItem[]) => void
) => {
  const dispatch = useAppDispatch();
  const { timetableId } = useScenarioContext();
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

  const persistTrain = async (train: TimetableItem): Promise<'updated'> => {
    await updateTrainSchedule({
      id: train.id,
      trainSchedule: train,
    }).unwrap();
    upsertTrainSchedules([train]);
    return 'updated';
  };

  /**
   * Compute the updated path and schedule based on the cell update.
   */
  const computeUpdatedPathAndSchedule = useCallback(
    (
      update: Exclude<CellUpdate, PowerRestrictionUpdate>
    ):
      | {
          updatedPath: PathItem[];
          updatedSchedule: ScheduleItem[];
          updatedMargins: TrainSchedule['margins'];
          updatedStartTime?: Date;
        }
      | undefined => {
      const propagatedResult = propagateTime(update, selectedTrain);
      if (propagatedResult) return { ...propagatedResult, updatedMargins: selectedTrain.margins };

      const { pathStepId, updatedPath } = upsertPathStep(update.row, selectedTrain.path, allRows);
      const currentSchedule = selectedTrain.schedule ?? [];
      const existingItemIndex = currentSchedule.findIndex((item) => item.at === pathStepId);
      const isOrigin = pathStepId === updatedPath[0].id;

      if (update.field === 'requestedTheoreticalMargin') {
        return {
          updatedPath,
          updatedSchedule: currentSchedule,
          updatedMargins: computeUpdatedMargins(updatedPath, update.value, pathStepId),
        };
      }

      // receptionSignal: directly update the schedule item's reception_signal field.
      // A stop is always required to edit reception signal
      if (update.field === 'receptionSignal') {
        if (existingItemIndex < 0) return undefined;
        const updatedSchedule = replaceElementAtIndex(currentSchedule, existingItemIndex, {
          ...currentSchedule[existingItemIndex],
          reception_signal: update.value,
        });
        return {
          updatedPath,
          updatedSchedule,
          updatedMargins: selectedTrain.margins,
        };
      }

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

      const startTime = new Date(selectedTrain.start_time);
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
        const newItem: ScheduleItem = { at: pathStepId };
        if (newArrival !== null && !isOrigin) newItem.arrival = newArrival;
        if (newStopFor !== null) newItem.stop_for = newStopFor;
        updatedSchedule = insertScheduleItemInOrder(currentSchedule, newItem, updatedPath);
      }

      // For atThisWaypoint: stops after the edited point that now fall before it in time
      // must be bumped to the next day.
      if (
        (update.field === 'requestedArrival' || update.field === 'requestedDeparture') &&
        update.propagationMode === 'atThisWaypoint' &&
        update.value !== null &&
        !isOrigin
      ) {
        updatedSchedule = adjustFollowingWaypointsForMidnight(update.value, pathStepId, {
          ...selectedTrain,
          schedule: updatedSchedule,
        });
      }

      return { updatedPath, updatedSchedule, updatedMargins: selectedTrain.margins };
    },
    [selectedTrain, allRows, computeUpdatedMargins]
  );

  /**
   * Compute the updated path and rebuilt power_restrictions array when a power restriction
   * cell is edited. The edited row is upserted as a path step (so a new restriction can
   * be set on a non-path-step waypoint).
   */
  const computePowerRestrictionUpdate = (update: PowerRestrictionUpdate) => {
    const { pathStepId, updatedPath } = upsertPathStep(update.row, selectedTrain.path, allRows);
    const modifiedRows = allRows.map((r) =>
      r.id === update.row.id
        ? {
            ...r,
            id: pathStepId,
            isPathStep: true,
            powerRestriction: update.value,
          }
        : r
    );
    return {
      updatedPath,
      powerRestrictions: buildPowerRestrictionsFromRows(modifiedRows),
    };
  };

  /**
   * Handle update when the selected train is an occurrence of a PacedTrain.
   * Uses exception-specific endpoints instead of updating the full paced train.
   */
  const updateOccurrence = useCallback(
    async (occurrenceId: OccurrenceId, update: CellUpdate): Promise<UpdateCellStatus> => {
      const pacedTrainId = extractEditoastIdFromPacedTrainId(
        extractPacedTrainIdFromOccurrenceId(occurrenceId)
      );
      const originalPacedTrainWithDetails = trainSchedulesWithDetails.find(
        (trainSchedule) => trainSchedule.id === pacedTrainId
      );

      if (
        !originalPacedTrainWithDetails ||
        !isPacedTrainWithDetails(originalPacedTrainWithDetails)
      ) {
        throw new Error(`Parent PacedTrain not found for occurrence: ${occurrenceId}`);
      }

      const formattedPacedTrain = formatPacedTrainWithDetailsToPacedTrainPayload(
        originalPacedTrainWithDetails
      );
      if (!isPacedTrainBase(formattedPacedTrain)) {
        throw new Error('Formatted PacedTrain is missing paced field');
      }
      // formatPacedTrainWithDetailsToPacedTrainPayload intentionally strips exceptions
      // (they have dedicated endpoints). Restore the actual list from timetableItemsWithDetails
      // so lookups, diff computation, and local state updates see the full current state.
      const originalPacedTrain: PacedTrainWithPaced = {
        ...formattedPacedTrain,
        paced: {
          ...formattedPacedTrain.paced,
          exceptions: originalPacedTrainWithDetails.paced.exceptions,
        },
      };

      // selectedTrain.train_name is the paced train's BASE name, but the
      // exception diff expects the occurrence's computed name.
      const occurrenceTrainName = getOccurrenceTrainName(originalPacedTrain, occurrenceId);

      let updatedOccurrence: TrainSchedule;
      if (update.field === 'powerRestriction') {
        const { updatedPath, powerRestrictions } = computePowerRestrictionUpdate(update);
        updatedOccurrence = buildUpdatedOccurrence({
          selectedTrain,
          updatedPath,
          updatedSchedule: selectedTrain.schedule ?? [],
          trainName: occurrenceTrainName,
          powerRestrictions,
        });
      } else {
        const result = computeUpdatedPathAndSchedule(update);
        if (!result) return 'skipped';

        const trainWithUpdatedMargins = {
          ...selectedTrain,
          margins: result.updatedMargins,
        };
        updatedOccurrence = {
          ...buildUpdatedOccurrence({
            selectedTrain: trainWithUpdatedMargins,
            updatedPath: result.updatedPath,
            updatedSchedule: result.updatedSchedule,
            trainName: occurrenceTrainName,
          }),
          start_time: result.updatedStartTime?.toISOString() ?? selectedTrain.start_time,
        };
      }

      const { generatedException, existingException, occurrenceIndex } =
        buildOccurrenceExceptionData(originalPacedTrain, updatedOccurrence, occurrenceId);

      const finalException = await syncOccurrenceException(
        dispatch,
        generatedException,
        existingException,
        occurrenceIndex,
        pacedTrainId,
        timetableId
      );

      const updatedExceptions = updatePacedTrainExceptionsList(
        originalPacedTrain.paced.exceptions,
        finalException,
        occurrenceId
      );

      return persistTrain({
        ...originalPacedTrain,
        id: pacedTrainId,
        train_schedule_set_id: originalPacedTrainWithDetails.train_schedule_set_id,
        paced: { ...originalPacedTrain.paced, exceptions: updatedExceptions },
      });
    },
    [selectedTrain, trainSchedulesWithDetails, computeUpdatedPathAndSchedule, timetableId, dispatch]
  );

  /**
   * Handle update when the selected train is a TrainSchedule (not an occurrence).
   */
  const handleUpdateTrainSchedule = useCallback(
    async (trainId: PacedTrainId, update: CellUpdate): Promise<UpdateCellStatus> => {
      const editoastId = extractEditoastIdFromPacedTrainId(trainId);

      if (update.field === 'powerRestriction') {
        const { updatedPath, powerRestrictions } = computePowerRestrictionUpdate(update);
        return persistTrain({
          ...selectedTrain,
          id: editoastId,
          path: updatedPath,
          power_restrictions: powerRestrictions,
        });
      }

      const result = computeUpdatedPathAndSchedule(update);
      if (!result) return 'skipped';

      return persistTrain({
        ...selectedTrain,
        id: editoastId,
        path: result.updatedPath,
        schedule: result.updatedSchedule,
        margins: result.updatedMargins,
        start_time: result.updatedStartTime?.toISOString() ?? selectedTrain.start_time,
      });
    },
    [selectedTrain, computeUpdatedPathAndSchedule, updateTrainSchedule]
  );

  /**
   * Main update function that routes to the appropriate handler.
   */
  const updateCell = useCallback(
    async (update: CellUpdate): Promise<UpdateCellStatus> => {
      const { id: trainId } = selectedTrain;

      if (isOccurrenceId(trainId)) {
        return updateOccurrence(trainId, update);
      } else if (isPacedTrainId(trainId)) {
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
    (row: TimesStopsRowNew, arrival: Date | null, propagationMode: PropagationMode) =>
      updateCell({
        row,
        field: 'requestedArrival',
        value: arrival,
        propagationMode,
      }),
    [updateCell]
  );

  const updateStopDuration = useCallback(
    (row: TimesStopsRowNew, durationSeconds: number | null) =>
      updateCell({ row, field: 'stopDuration', value: durationSeconds }),
    [updateCell]
  );

  const updateDeparture = useCallback(
    (row: TimesStopsRowNew, departure: Date | null, propagationMode: PropagationMode) =>
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

  return {
    updateArrival,
    updateStopDuration,
    updateDeparture,
    updateReceptionSignal,
    updateRequestedMargin,
    updatePowerRestrictions,
  };
};

export default useUpdateTimesStopsTable;
