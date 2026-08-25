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
import { replaceElementAtIndex } from 'utils/array';
import { Duration, startTimeToMs, subtractStartTime } from 'utils/duration';
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
  upsertScheduleItem,
  computePendingEditsFromSchedule,
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
  MarginValue,
  PendingEdit,
  TimesStopsRow,
  UpdateCellStatus,
  BatchTimesUpdate,
  ReferenceBaseArrivalUpdate,
} from '../types';

/** The train fields an edit can change. */
type TrainPatch = Partial<
  Pick<TrainSchedule, 'path' | 'schedule' | 'margins' | 'power_restrictions' | 'start_time'>
>;

/** The train fields to persist for an edit, along with the edits to display while it is saved. */
type ComputedUpdate = { patch: TrainPatch | undefined; edits: PendingEdit[] };

/** A theoretical margin applies until the next boundary, so the rows in between display it too. */
const buildMarginEdits = (
  editedRow: TimesStopsRow,
  requestedMargin: MarginValue | null,
  rows: TimesStopsRow[]
): PendingEdit[] => {
  const edits: PendingEdit[] = [
    { rowId: editedRow.id, field: 'requestedTheoreticalMargin', value: requestedMargin },
  ];

  const editedIndex = rows.findIndex((r) => r.id === editedRow.id);
  if (editedIndex === -1) return edits;

  for (let i = editedIndex + 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.isTheoreticalMarginBoundary) break;
    edits.push({ rowId: row.id, field: 'requestedTheoreticalMargin', value: requestedMargin });
  }

  return edits;
};

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
  allRows: TimesStopsRow[],
  trainSchedulesWithDetails: TrainScheduleWithDetails[]
) => {
  const dispatch = useAppDispatch();
  const { timetableId, scenario } = useScenarioContext();
  const { upsertTrainSchedules } = useTimetableContext();
  const [updateTrainSchedule] = osrdEditoastApi.endpoints.putTrainSchedulesById.useMutation();

  const persistTrain = useCallback(
    async (train: TrainScheduleResponse): Promise<'updated'> => {
      await updateTrainSchedule({
        id: train.id,
        trainSchedule: train,
      }).unwrap();
      upsertTrainSchedules([train]);
      return 'updated';
    },
    [updateTrainSchedule, upsertTrainSchedules]
  );

  const computeMarginUpdate = useCallback(
    (update: RequestedMarginUpdate): ComputedUpdate => {
      const { pathStepId, updatedPath } = upsertPathStep(update.row, selectedTrain.path, allRows);
      const edits = buildMarginEdits(update.row, update.value, allRows);

      const baseTrainInputs: Pick<TrainSchedule, 'path' | 'schedule' | 'margins'> = {
        path: updatedPath,
        schedule: selectedTrain.schedule,
        margins: selectedTrain.margins,
      };
      const updatedPathSteps = updatedPath.map((_, index) =>
        computeBasePathStep(baseTrainInputs, index)
      );

      const targetedStep = updatedPathSteps.find((step) => step.id === pathStepId);

      if (!targetedStep) return { patch: { path: updatedPath }, edits };

      targetedStep.theoreticalMargin = formatRequestedMargin(update.value) ?? undefined;
      return { patch: { path: updatedPath, margins: formatMargin(updatedPathSteps) }, edits };
    },
    [selectedTrain, allRows]
  );

  /** A stop is always required to edit a reception signal, so its schedule item must exist. */
  const computeReceptionSignalUpdate = useCallback(
    (update: ReceptionSignalUpdate): ComputedUpdate => {
      const { pathStepId, updatedPath } = upsertPathStep(update.row, selectedTrain.path, allRows);
      const edits: PendingEdit[] = [
        { rowId: update.row.id, field: 'receptionSignal', value: update.value },
      ];
      const currentSchedule = selectedTrain.schedule ?? [];
      const existingItemIndex = currentSchedule.findIndex((item) => item.at === pathStepId);
      if (existingItemIndex < 0) return { patch: undefined, edits };

      return {
        patch: {
          path: updatedPath,
          schedule: replaceElementAtIndex(currentSchedule, existingItemIndex, {
            ...currentSchedule[existingItemIndex],
            reception_signal: update.value,
          }),
        },
        edits,
      };
    },
    [selectedTrain, allRows]
  );

  const computeTimesUpdate = useCallback(
    (update: ArrivalUpdate | DepartureUpdate | StopDurationUpdate): ComputedUpdate => {
      const propagatedResult =
        update.field === 'stopDuration'
          ? propagateStopDuration(update, selectedTrain, scenario.timetable_type)
          : propagateTime(update, selectedTrain, scenario.timetable_type);
      if (propagatedResult)
        return {
          patch: {
            path: propagatedResult.updatedPath,
            schedule: propagatedResult.updatedSchedule,
            start_time: startTimeToMs(propagatedResult.updatedStartTime),
          },
          edits: computePendingEditsFromSchedule(
            propagatedResult.updatedSchedule,
            propagatedResult.updatedStartTime,
            allRows
          ),
        };

      const { pathStepId, updatedPath } = upsertPathStep(update.row, selectedTrain.path, allRows);
      const currentSchedule = selectedTrain.schedule ?? [];
      const startTime = getTruncatedToSecondStartTime(selectedTrain, scenario.timetable_type);

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

      const { arrival, stop_for } = scheduleStateToApiFields(
        applyScheduleEdit(
          { arrival: update.row.requestedArrival, stop: update.row.stopDuration },
          edit
        ),
        startTime
      );
      const updatedSchedule = upsertScheduleItem(currentSchedule, updatedPath, {
        at: pathStepId,
        arrival,
        stop_for,
      });
      if (!updatedSchedule) return { patch: undefined, edits: [] };

      // The days must be right before saving
      const cascadedSchedule = cascadeArrivals({
        schedule: updatedSchedule,
        path: updatedPath,
        fromPathIndex: 1,
      });

      // Editing a row that is not a path step yet creates one
      const editedRows = update.row.pathStepId
        ? allRows
        : allRows.map((row) => (row.id === update.row.id ? { ...row, pathStepId } : row));

      return {
        patch: {
          path: updatedPath,
          schedule: cascadedSchedule,
          // The offsets above are rebuilt from the truncated start time, so it must be saved with them.
          start_time: startTimeToMs(startTime),
        },
        edits: computePendingEditsFromSchedule(cascadedSchedule, startTime, editedRows),
      };
    },
    [selectedTrain, allRows, scenario.timetable_type]
  );

  /**
   * Compute the updated path and rebuilt power_restrictions array when a power restriction
   * cell is edited. The edited row is upserted as a path step (so a new restriction can
   * be set on a non-path-step waypoint).
   */
  const computePowerRestrictionUpdate = useCallback(
    (update: PowerRestrictionUpdate): ComputedUpdate => {
      const { pathStepId, updatedPath } = upsertPathStep(update.row, selectedTrain.path, allRows);
      const modifiedRows = allRows.map((r) =>
        r.id === update.row.id ? { ...r, pathStepId, powerRestriction: update.value } : r
      );
      return {
        patch: {
          path: updatedPath,
          power_restrictions: buildPowerRestrictionsFromRows(modifiedRows),
        },
        edits: [{ rowId: update.row.id, field: 'powerRestriction', value: update.value }],
      };
    },
    [selectedTrain, allRows]
  );

  /** Fill several rows at once with the times computed by the simulation. */
  const computeBatchTimesUpdate = useCallback(
    (update: BatchTimesUpdate): ComputedUpdate => {
      let updatedSchedule = selectedTrain.schedule ?? [];
      let currentPath = selectedTrain.path;
      const edits: PendingEdit[] = [];

      const startTime = getTruncatedToSecondStartTime(selectedTrain, scenario.timetable_type);

      for (const row of update.rows) {
        const { pathStepId, updatedPath: updatedPathForRow } = upsertPathStep(
          row,
          currentPath,
          allRows
        );
        currentPath = updatedPathForRow;

        const edit: OptimisticEdit =
          update.field === 'requestedArrival'
            ? {
                field: 'requestedArrival',
                value: row.computedArrival,
              }
            : {
                field: 'requestedDeparture',
                value: row.computedDeparture,
              };
        edits.push({ rowId: row.id, ...edit });

        const { arrival, stop_for } = scheduleStateToApiFields(
          applyScheduleEdit({ arrival: row.requestedArrival, stop: row.stopDuration }, edit),
          startTime
        );
        // A row with no time to fill leaves the schedule untouched
        updatedSchedule =
          upsertScheduleItem(updatedSchedule, currentPath, { at: pathStepId, arrival, stop_for }) ??
          updatedSchedule;
      }

      return {
        patch: {
          path: currentPath,
          schedule: updatedSchedule,
          // The offsets above are rebuilt from the truncated start time, so it must be saved with them.
          start_time: startTimeToMs(startTime),
        },
        edits,
      };
    },
    [selectedTrain, allRows, scenario.timetable_type]
  );

  const computeReferenceBaseArrival = useCallback(
    (update: ReferenceBaseArrivalUpdate): ComputedUpdate => {
      const { pathStepId, updatedPath } = upsertPathStep(update.row, selectedTrain.path, allRows);

      const currentSchedule = selectedTrain.schedule ?? [];
      const startTime = getTruncatedToSecondStartTime(selectedTrain, scenario.timetable_type);

      const referenceBaseArrival =
        update.value !== null ? subtractStartTime(update.value, startTime).toISOString() : null;

      const updatedSchedule = upsertScheduleItem(currentSchedule, updatedPath, {
        at: pathStepId,
        reference_base_arrival: referenceBaseArrival,
      });

      return {
        patch: {
          path: updatedPath,
          schedule: updatedSchedule,
        },
        edits: [{ rowId: update.row.id, field: 'referenceBaseArrival', value: update.value }],
      };
    },
    [selectedTrain, allRows, scenario.timetable_type]
  );

  /** Compute the updated train fields for a cell update, and the edits to display meanwhile. */
  const computeTrainUpdate = useCallback(
    (update: CellUpdate): ComputedUpdate => {
      if ('rows' in update) return computeBatchTimesUpdate(update);
      if (update.field === 'powerRestriction') return computePowerRestrictionUpdate(update);
      if (update.field === 'requestedTheoreticalMargin') return computeMarginUpdate(update);
      if (update.field === 'receptionSignal') return computeReceptionSignalUpdate(update);
      if (update.field === 'referenceBaseArrival') return computeReferenceBaseArrival(update);
      return computeTimesUpdate(update);
    },
    [
      computeBatchTimesUpdate,
      computePowerRestrictionUpdate,
      computeMarginUpdate,
      computeReceptionSignalUpdate,
      computeTimesUpdate,
      computeReferenceBaseArrival,
    ]
  );

  /**
   * Handle update when the selected train is an occurrence of a PacedTrain.
   * Uses exception-specific endpoints instead of updating the full paced train.
   */
  const updateOccurrence = useCallback(
    async (occurrenceId: OccurrenceId, patch: TrainPatch): Promise<UpdateCellStatus> => {
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
    [
      selectedTrain,
      trainSchedulesWithDetails,
      computeTrainUpdate,
      timetableId,
      dispatch,
      persistTrain,
    ]
  );

  /**
   * Handle update when the selected train is a TrainSchedule (not an occurrence).
   */
  const handleUpdateTrainSchedule = useCallback(
    async (trainId: TrainScheduleId, patch: TrainPatch): Promise<UpdateCellStatus> =>
      persistTrain({
        ...selectedTrain,
        id: extractEditoastIdFromTrainScheduleId(trainId),
        ...patch,
      }),
    [selectedTrain, persistTrain]
  );

  /**
   * Persist a patch, routing to the appropriate handler.
   */
  const persistTrainPatch = useCallback(
    async (patch: TrainPatch | undefined): Promise<UpdateCellStatus> => {
      if (!patch) return 'skipped';
      const { id: trainId } = selectedTrain;

      if (isOccurrenceId(trainId)) {
        return updateOccurrence(trainId, patch);
      } else if (isTrainScheduleId(trainId)) {
        return handleUpdateTrainSchedule(trainId, patch);
      } else {
        throw new Error('TrainSchedules are not handled anymore.');
      }
    },
    [selectedTrain, updateOccurrence, handleUpdateTrainSchedule]
  );

  return { computeTrainUpdate, persistTrainPatch };
};

export default useUpdateTimesStopsTable;
