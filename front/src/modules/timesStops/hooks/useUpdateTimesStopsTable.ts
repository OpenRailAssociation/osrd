import { useCallback } from 'react';

import { isNil } from 'lodash';

import { buildPacedTrainWithUpdatedException } from 'applications/operationalStudies/views/Scenario/components/ManageTimetableItem/helpers/buildPacedTrainException';
import { formatPacedTrainWithDetailsToPacedTrainPayload } from 'applications/operationalStudies/views/Scenario/components/ManageTimetableItem/helpers/formatTimetableItemPayload';
import {
  osrdEditoastApi,
  type TrainSchedule,
  type PathItem,
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
import {
  extractEditoastIdFromPacedTrainId,
  extractPacedTrainIdFromOccurrenceId,
  isOccurrenceId,
  isPacedTrainId,
} from 'utils/trainId';

import {
  upsertPathStep,
  buildScheduleItemForField,
  buildUpdatedOccurrence,
  insertScheduleItemInOrder,
} from '../helpers/cellUpdate';
import type { CellUpdate, TimesStopsRowNew } from '../types';

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
  const [updatePacedTrain] = osrdEditoastApi.endpoints.putPacedTrainById.useMutation();

  /**
   * Compute the updated path and schedule based on the cell update.
   */
  const computeUpdatedPathAndSchedule = useCallback(
    (
      update: CellUpdate
    ): { updatedPath: PathItem[]; updatedSchedule: ScheduleItem[] } | undefined => {
      const { pathStepId, updatedPath } = upsertPathStep(update.row, selectedTrain.path, allRows);
      const currentSchedule = selectedTrain.schedule ?? [];
      const existingScheduleItemIndex = currentSchedule.findIndex((item) => item.at === pathStepId);
      let updatedSchedule: ScheduleItem[];

      // Handle clearing the value (setting to null)
      if (update.value === null) {
        if (existingScheduleItemIndex < 0) return undefined;

        const fieldToNull: Extract<keyof ScheduleItem, 'arrival' | 'stop_for'> =
          update.field === 'requestedArrival' ? 'arrival' : 'stop_for';
        const updatedScheduleItem: ScheduleItem = {
          ...currentSchedule[existingScheduleItemIndex],
          [fieldToNull]: null,
        };

        const shouldRemoveScheduleItem =
          isNil(updatedScheduleItem.arrival) && isNil(updatedScheduleItem.stop_for);

        updatedSchedule = shouldRemoveScheduleItem
          ? removeElementAtIndex(currentSchedule, existingScheduleItemIndex)
          : replaceElementAtIndex(currentSchedule, existingScheduleItemIndex, updatedScheduleItem);

        return { updatedPath, updatedSchedule };
      }

      // Handle setting a new value
      const startTime = new Date(selectedTrain.start_time);
      const newScheduleItem: ScheduleItem = {
        at: pathStepId,
        ...buildScheduleItemForField({ update, startTime }),
      };

      updatedSchedule =
        existingScheduleItemIndex >= 0
          ? replaceElementAtIndex(currentSchedule, existingScheduleItemIndex, {
              ...currentSchedule[existingScheduleItemIndex],
              ...newScheduleItem,
            })
          : insertScheduleItemInOrder(currentSchedule, newScheduleItem, updatedPath);

      return { updatedPath, updatedSchedule };
    },
    [selectedTrain, allRows]
  );

  /**
   * Handle update when the selected train is an occurrence of a PacedTrain.
   */
  const updateOccurrence = useCallback(
    async (occurrenceId: OccurrenceId, update: CellUpdate) => {
      const pacedTrainId = extractPacedTrainIdFromOccurrenceId(occurrenceId);
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

      // Build updated occurrence based on update type
      let updatedOccurrence: TrainSchedule;
      if (update.field === 'requestedArrival' && update.row.opOnPathIndex === 0) {
        if (!update.value) {
          console.error('Cannot clear start time on the origin');
          return;
        }
        updatedOccurrence = {
          ...buildUpdatedOccurrence(
            selectedTrain,
            selectedTrain.path,
            selectedTrain.schedule ?? [],
            occurrenceTrainName
          ),
          start_time: update.value.toISOString(),
        };
      } else {
        const result = computeUpdatedPathAndSchedule(update);
        if (!result) return;
        updatedOccurrence = buildUpdatedOccurrence(
          selectedTrain,
          result.updatedPath,
          result.updatedSchedule,
          occurrenceTrainName
        );
      }

      const updatedPacedTrain = buildPacedTrainWithUpdatedException(
        originalPacedTrain,
        updatedOccurrence,
        occurrenceId
      );

      await updatePacedTrain({
        id: extractEditoastIdFromPacedTrainId(pacedTrainId),
        trainSchedule: updatedPacedTrain,
      }).unwrap();
      upsertTimetableItems([{ ...updatedPacedTrain, id: pacedTrainId }]);
    },
    [selectedTrain, timetableItemsWithDetails, computeUpdatedPathAndSchedule]
  );

  /**
   * Handle update when the selected train is a TimetableItem (not an occurrence).
   */
  const updateTimetableItem = useCallback(
    async (trainId: PacedTrainId, update: CellUpdate) => {
      // Handle first row
      if (update.field === 'requestedArrival' && update.row.opOnPathIndex === 0) {
        if (!update.value) return;

        const train: TimetableItem = {
          ...selectedTrain,
          id: trainId,
          start_time: update.value.toISOString(),
        };

        await updatePacedTrain({
          id: extractEditoastIdFromPacedTrainId(trainId),
          trainSchedule: train,
        }).unwrap();
        upsertTimetableItems([train]);
        return;
      }

      const result = computeUpdatedPathAndSchedule(update);
      if (!result) return;

      const { updatedPath, updatedSchedule } = result;
      const train: TimetableItem = {
        ...selectedTrain,
        id: trainId,
        path: updatedPath,
        schedule: updatedSchedule,
      };

      await updatePacedTrain({
        id: extractEditoastIdFromPacedTrainId(trainId),
        trainSchedule: train,
      }).unwrap();
      upsertTimetableItems([train]);
    },
    [selectedTrain, computeUpdatedPathAndSchedule]
  );

  /**
   * Main update function that routes to the appropriate handler.
   */
  const updateCell = useCallback(
    async (update: CellUpdate) => {
      const { id: trainId } = selectedTrain;

      if (isOccurrenceId(trainId)) {
        await updateOccurrence(trainId, update);
      } else if (isPacedTrainId(trainId)) {
        await updateTimetableItem(trainId, update);
      } else {
        throw new Error('TrainSchedules are not handled anymore.');
      }
    },
    [selectedTrain, updateOccurrence, updateTimetableItem]
  );

  // Functions are included in deps (exception to the project convention) to propagate
  // allRows updates through the entire callback chain.
  const updateArrival = useCallback(
    (row: TimesStopsRowNew, arrival: Date | null) =>
      updateCell({ row, field: 'requestedArrival', value: arrival }),
    [updateCell]
  );

  const updateStopDuration = useCallback(
    (row: TimesStopsRowNew, durationSeconds: number | null) =>
      updateCell({ row, field: 'stopDuration', value: durationSeconds }),
    [updateCell]
  );

  const updateDeparture = useCallback(
    (row: TimesStopsRowNew, departure: Date | null) =>
      updateCell({ row, field: 'requestedDeparture', value: departure }),
    [updateCell]
  );

  return {
    updateArrival,
    updateStopDuration,
    updateDeparture,
  };
};

export default useUpdateTimesStopsTable;
