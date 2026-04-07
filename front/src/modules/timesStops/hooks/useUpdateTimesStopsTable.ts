import { useCallback } from 'react';

import { buildPacedTrainWithUpdatedException } from 'applications/operationalStudies/views/Scenario/components/ManageTimetableItem/helpers/buildPacedTrainException';
import { formatPacedTrainWithDetailsToPacedTrainPayload } from 'applications/operationalStudies/views/Scenario/components/ManageTimetableItem/helpers/formatTimetableItemPayload';
import {
  osrdEditoastApi,
  type TrainSchedule,
  type PathItem,
  type ReceptionSignal,
  type ScheduleItem,
} from 'common/api/osrdEditoastApi';
import {
  getOccurrenceTrainName,
  isPacedTrainBase,
  isPacedTrainWithDetails,
} from 'modules/timetableItem/helpers/pacedTrain';
import type { TimetableItemWithDetails } from 'modules/timetableItem/types';
import type { OccurrenceId, PacedTrainId, TimetableItem, Train } from 'reducers/osrdconf/types';
import { removeElementAtIndex, replaceElementAtIndex } from 'utils/array';
import { Duration } from 'utils/duration';
import {
  extractEditoastIdFromPacedTrainId,
  extractPacedTrainIdFromOccurrenceId,
  isOccurrenceId,
  isPacedTrainId,
} from 'utils/trainId';

import {
  upsertPathStep,
  applyScheduleEdit,
  scheduleStateToApiFields,
  buildUpdatedOccurrence,
  insertScheduleItemInOrder,
} from '../helpers/cellUpdate';
import { propagateTime } from '../helpers/timePropagation';
import type {
  ArrivalUpdate,
  CellUpdate,
  OptimisticEdit,
  PropagationMode,
  TimesStopsRowNew,
  UpdateCellStatus,
} from '../types';

const isOriginArrivalUpdate = (update: CellUpdate): update is ArrivalUpdate =>
  update.field === 'requestedArrival' && update.row.opOnPathIndex === 0;

/**
 * Hook that provides a callback to update times/stops cell values.
 * When a cell is edited (TimeCell or DurationCell), this callback:
 * 1. Updates the train's schedule array
 * 2. Calls the API to persist the change
 * 3. Triggers simulation re-run via upsertTimetableItems
 *
 * When editing an occurrence:
 * - Finds the parent PacedTrain from timetableItemsWithDetails
 * - Generates or updates the exception for this occurrence
 * - Updates the PacedTrain with the new exception
 * - Calls upsertTimetableItems to trigger re-simulation
 */
const useUpdateTimesStopsTable = (
  selectedTrain: Train,
  allRows: TimesStopsRowNew[],
  timetableItemsWithDetails: TimetableItemWithDetails[],
  upsertTimetableItems: (timetableItems: TimetableItem[]) => void
) => {
  const [updateTrainSchedule] = osrdEditoastApi.endpoints.putTrainSchedulesById.useMutation();

  /**
   * Compute the updated path and schedule based on the cell update.
   */
  const computeUpdatedPathAndSchedule = useCallback(
    (
      update: CellUpdate
    ):
      | { updatedPath: PathItem[]; updatedSchedule: ScheduleItem[]; updatedStartTime?: Date }
      | undefined => {
      const propagatedResult = propagateTime(update, selectedTrain);
      if (propagatedResult) return propagatedResult;

      const { pathStepId, updatedPath } = upsertPathStep(update.row, selectedTrain.path, allRows);
      const currentSchedule = selectedTrain.schedule ?? [];
      const existingItemIndex = currentSchedule.findIndex((item) => item.at === pathStepId);
      const isOrigin = pathStepId === updatedPath[0].id;

      // receptionSignal: directly update the schedule item's reception_signal field.
      // A stop is always required to edit reception signal
      if (update.field === 'receptionSignal') {
        if (existingItemIndex < 0) return undefined;
        const updatedSchedule = replaceElementAtIndex(currentSchedule, existingItemIndex, {
          ...currentSchedule[existingItemIndex],
          reception_signal: update.value,
        });
        return { updatedPath, updatedSchedule };
      }

      // Convert CellUpdate to OptimisticEdit (stopDuration: number → Duration)
      let edit: OptimisticEdit;
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

      return { updatedPath, updatedSchedule };
    },
    [selectedTrain, allRows]
  );

  /**
   * Handle update when the selected train is an occurrence of a PacedTrain.
   */
  const updateOccurrence = useCallback(
    async (occurrenceId: OccurrenceId, update: CellUpdate): Promise<UpdateCellStatus> => {
      const pacedTrainId = extractEditoastIdFromPacedTrainId(
        extractPacedTrainIdFromOccurrenceId(occurrenceId)
      );
      const originalPacedTrainWithDetails = timetableItemsWithDetails.find(
        (item) => item.id === pacedTrainId
      );

      if (
        !originalPacedTrainWithDetails ||
        !isPacedTrainWithDetails(originalPacedTrainWithDetails)
      ) {
        throw new Error(`Parent PacedTrain not found for occurrence: ${occurrenceId}`);
      }

      const originalPacedTrain = formatPacedTrainWithDetailsToPacedTrainPayload(
        originalPacedTrainWithDetails
      );
      if (!isPacedTrainBase(originalPacedTrain)) {
        throw new Error('Formatted PacedTrain is missing paced field');
      }

      // selectedTrain.train_name is the paced train's BASE name, but the
      // exception diff expects the occurrence's computed name.
      const occurrenceTrainName = getOccurrenceTrainName(originalPacedTrain, occurrenceId);

      const isOriginUpdate = isOriginArrivalUpdate(update);
      if (isOriginUpdate && !update.value) return 'skipped';

      // Build updated occurrence based on update type
      let updatedOccurrence: TrainSchedule;
      if (isOriginUpdate && update.propagationMode === 'atThisWaypoint') {
        const startTime = update.value;
        if (!startTime) return 'skipped';

        updatedOccurrence = {
          ...buildUpdatedOccurrence(
            selectedTrain,
            selectedTrain.path,
            selectedTrain.schedule ?? [],
            occurrenceTrainName
          ),
          start_time: startTime.toISOString(),
        };
      } else {
        const result = computeUpdatedPathAndSchedule(update);
        if (!result) return 'skipped';
        updatedOccurrence = {
          ...buildUpdatedOccurrence(
            selectedTrain,
            result.updatedPath,
            result.updatedSchedule,
            occurrenceTrainName
          ),
          start_time: result.updatedStartTime?.toISOString() ?? selectedTrain.start_time,
        };
      }

      // TODO_EXCEPTIONS: buildPacedTrainWithUpdatedException look like formatPacedTrainPayload
      const updatedPacedTrain = buildPacedTrainWithUpdatedException(
        originalPacedTrain,
        updatedOccurrence,
        occurrenceId
      );

      await updateTrainSchedule({
        id: pacedTrainId,
        trainSchedule: updatedPacedTrain,
      }).unwrap();
      upsertTimetableItems([{ ...updatedPacedTrain, id: pacedTrainId }]);
      return 'updated';
    },
    [selectedTrain, timetableItemsWithDetails, computeUpdatedPathAndSchedule]
  );

  /**
   * Handle update when the selected train is a TimetableItem (not an occurrence).
   */
  const updateTimetableItem = useCallback(
    async (trainId: PacedTrainId, update: CellUpdate): Promise<UpdateCellStatus> => {
      const editoastId = extractEditoastIdFromPacedTrainId(trainId);
      const isOriginUpdate = isOriginArrivalUpdate(update);
      if (isOriginUpdate && !update.value) return 'skipped';

      // Handle first row at this waypoint
      if (isOriginUpdate && update.propagationMode === 'atThisWaypoint') {
        const startTime = update.value;
        if (!startTime) return 'skipped';

        const train: TimetableItem = {
          ...selectedTrain,
          id: editoastId,
          start_time: startTime.toISOString(),
        };

        await updateTrainSchedule({
          id: editoastId,
          trainSchedule: train,
        }).unwrap();
        upsertTimetableItems([train]);
        return 'updated';
      }

      const result = computeUpdatedPathAndSchedule(update);
      if (!result) return 'skipped';

      const { updatedPath, updatedSchedule } = result;
      const train: TimetableItem = {
        ...selectedTrain,
        id: editoastId,
        path: updatedPath,
        schedule: updatedSchedule,
        start_time: result.updatedStartTime?.toISOString() ?? selectedTrain.start_time,
      };

      await updateTrainSchedule({
        id: editoastId,
        trainSchedule: train,
      }).unwrap();
      upsertTimetableItems([train]);
      return 'updated';
    },
    [selectedTrain, computeUpdatedPathAndSchedule]
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
        return updateTimetableItem(trainId, update);
      } else {
        throw new Error('TrainSchedules are not handled anymore.');
      }
    },
    [selectedTrain, updateOccurrence, updateTimetableItem]
  );

  // Functions are included in deps (exception to the project convention) to propagate
  // allRows updates through the entire callback chain.
  const updateArrival = useCallback(
    (row: TimesStopsRowNew, arrival: Date | null, propagationMode: PropagationMode) =>
      updateCell({ row, field: 'requestedArrival', value: arrival, propagationMode }),
    [updateCell]
  );

  const updateStopDuration = useCallback(
    (row: TimesStopsRowNew, durationSeconds: number | null) =>
      updateCell({ row, field: 'stopDuration', value: durationSeconds }),
    [updateCell]
  );

  const updateDeparture = useCallback(
    (row: TimesStopsRowNew, departure: Date | null, propagationMode: PropagationMode) =>
      updateCell({ row, field: 'requestedDeparture', value: departure, propagationMode }),
    [updateCell]
  );

  const updateReceptionSignal = useCallback(
    (row: TimesStopsRowNew, receptionSignal: ReceptionSignal | undefined) =>
      updateCell({ row, field: 'receptionSignal', value: receptionSignal }),
    [updateCell]
  );

  return {
    updateArrival,
    updateStopDuration,
    updateDeparture,
    updateReceptionSignal,
  };
};

export default useUpdateTimesStopsTable;
