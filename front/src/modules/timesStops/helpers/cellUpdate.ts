import { v4 as uuidV4 } from 'uuid';

import type {
  TrainSchedule,
  PathItem,
  PowerRestrictionItem,
  ScheduleItem,
} from 'common/api/osrdEditoastApi';
import type { Train } from 'reducers/osrdconf/types';
import { addElementAtIndex } from 'utils/array';
import { Duration } from 'utils/duration';

import type { OptimisticEdit, PendingEdit, TimesStopsRowNew } from '../types';
import { receptionSignalToSignalBooleans } from './utils';

/** Compute the insertion index for a new PathStep using row opOnPathIndex values. */
const computeInsertIndex = (
  editedOpIndex: number,
  allRows: TimesStopsRowNew[],
  currentPath: PathItem[]
): number => {
  // Build a map of pathStepId -> opOnPathIndex from rows that are path steps
  const pathStepOpIndices = new Map(
    allRows.filter((r) => r.pathStepId).map((r) => [r.pathStepId!, r.opOnPathIndex])
  );

  // Find the first PathStep whose opOnPathIndex is greater than the edited OP's
  const foundIndex = currentPath.findIndex((step) => {
    const opIndex = pathStepOpIndices.get(step.key);
    return opIndex !== undefined && opIndex > editedOpIndex;
  });

  return foundIndex === -1 ? currentPath.length : foundIndex;
};

/** Find existing PathStep or create a new one at the correct position. */
export const upsertPathStep = (
  editedRow: TimesStopsRowNew,
  currentPath: PathItem[],
  allRows: TimesStopsRowNew[]
): { pathStepKey: string; updatedPath: PathItem[] } => {
  if (editedRow.pathStepId) {
    return { pathStepKey: editedRow.pathStepId, updatedPath: currentPath };
  }

  const newPathStep: PathItem = { key: uuidV4(), location: editedRow.location };
  const insertIndex = computeInsertIndex(editedRow.opOnPathIndex, allRows, currentPath);
  const updatedPath = addElementAtIndex(currentPath, insertIndex, newPathStep);

  return { pathStepKey: newPathStep.key, updatedPath };
};

/** Compute departure from arrival and stop duration. */
const computeDeparture = (arrival: Date | null, stop: Duration | null): Date | null =>
  arrival !== null && stop !== null ? new Date(arrival.getTime() + stop.ms) : null;

/** Difference between two dates, truncated to whole seconds. */
const diffSeconds = (a: Date, b: Date) =>
  Math.floor(a.getTime() / 1000) - Math.floor(b.getTime() / 1000);

/** State of a stop's schedule in display format (Date / Duration). */
export type ScheduleState = {
  arrival: Date | null;
  stop: Duration | null;
};

/**
 * Apply a schedule field edit to the current state.
 * Single source of truth for schedule editing business rules.
 * Both optimistic display updates and API payload computation derive from this function.
 *
 * Note: Day adjustment for overnight journeys is handled by TimeCell using referenceDate.
 * The dates received here are already on the correct calendar day.
 */
export const applyScheduleEdit = (
  current: ScheduleState,
  edit: Exclude<OptimisticEdit, { field: 'powerRestriction' }>
): ScheduleState & { departure: Date | null } => {
  const { arrival, stop } = current;

  switch (edit.field) {
    case 'requestedArrival': {
      const newArrival = edit.value;
      return {
        arrival: newArrival,
        stop,
        departure: computeDeparture(newArrival, stop),
      };
    }

    case 'stopDuration': {
      const newStop = edit.value;
      return {
        arrival,
        stop: newStop,
        departure: computeDeparture(arrival, newStop),
      };
    }

    case 'stopDurationWithArrival': {
      const { stop: newStop, arrival: newArrival } = edit.value;
      return {
        arrival: newArrival,
        stop: newStop,
        departure: computeDeparture(newArrival, newStop),
      };
    }

    case 'requestedDeparture': {
      const newDeparture = edit.value;
      if (newDeparture === null) {
        return { arrival: null, stop, departure: null };
      }
      if (arrival !== null) {
        // Arrival exists → stop = departure - arrival
        // TimeCell already ensured departure >= arrival by using arrival as referenceDate
        return {
          arrival,
          stop: new Duration({ milliseconds: newDeparture.getTime() - arrival.getTime() }),
          departure: newDeparture,
        };
      }
      // No arrival → arrival = departure - existingStop
      return {
        arrival: new Date(newDeparture.getTime() - (stop?.ms ?? 0)),
        stop,
        departure: newDeparture,
      };
    }

    default: {
      return {
        arrival,
        stop,
        departure: computeDeparture(arrival, stop),
      };
    }
  }
};

/**
 * Convert a ScheduleState to API ScheduleItem fields (ISO duration strings relative to startTime).
 */
export const scheduleStateToApiFields = (
  state: ScheduleState,
  startTime: Date
): { arrival: string | null; stop_for: string | null } => ({
  arrival:
    state.arrival !== null
      ? new Duration({ seconds: diffSeconds(state.arrival, startTime) }).toISOString()
      : null,
  stop_for: state.stop !== null ? state.stop.toISOString() : null,
});

const getPathIndex = (pathStepKey: string, path: PathItem[]) =>
  path.findIndex((step) => step.key === pathStepKey);

/**
 * Insert a schedule item at the correct position to maintain path order.
 * Schedule items should be ordered according to their path step position.
 */
export const insertScheduleItemInOrder = (
  schedule: ScheduleItem[],
  newItem: ScheduleItem,
  path: PathItem[]
): ScheduleItem[] => {
  const newItemPathIndex = getPathIndex(newItem.at, path);

  const foundIndex = schedule.findIndex((item) => getPathIndex(item.at, path) > newItemPathIndex);
  const insertIndex = foundIndex === -1 ? schedule.length : foundIndex;

  return addElementAtIndex(schedule, insertIndex, newItem);
};

/**
 * Compute the optimistic display values for the fields affected by a cell edit.
 * Returns only the fields that need to change — the caller is expected to merge
 * the result with the row (e.g. `{ ...row, ...computeOptimisticRow(row, edit) }`).
 */
export const computeOptimisticRow = (
  row: TimesStopsRowNew,
  edit: OptimisticEdit
): Partial<
  Pick<
    TimesStopsRowNew,
    | 'requestedArrival'
    | 'stopDuration'
    | 'requestedDeparture'
    | 'closedSignal'
    | 'shortSlipDistance'
    | 'requestedTheoreticalMargin'
    | 'powerRestriction'
  >
> => {
  if (edit.field === 'powerRestriction') {
    return {
      requestedArrival: row.requestedArrival,
      stopDuration: row.stopDuration,
      requestedDeparture: row.requestedDeparture,
      closedSignal: row.closedSignal,
      shortSlipDistance: row.shortSlipDistance,
      requestedTheoreticalMargin: row.requestedTheoreticalMargin,
      powerRestriction: edit.value,
    };
  }

  const { arrival, stop, departure } = applyScheduleEdit(
    { arrival: row.requestedArrival, stop: row.stopDuration },
    edit
  );

  const checkboxes =
    edit.field === 'receptionSignal'
      ? receptionSignalToSignalBooleans(edit.value)
      : { closedSignal: row.closedSignal, shortSlipDistance: row.shortSlipDistance };

  const requestedTheoreticalMargin =
    edit.field === 'requestedTheoreticalMargin' && row.isTheoreticalMarginBoundary
      ? (edit.value ?? undefined)
      : row.requestedTheoreticalMargin;

  return {
    requestedArrival: arrival,
    stopDuration: stop,
    requestedDeparture: departure,
    ...checkboxes,
    requestedTheoreticalMargin,
    powerRestriction: row.powerRestriction,
  };
};

/**
 * Converts a propagation result into PendingEdits for all affected rows.
 * Each affected row gets a new requestedArrival computed from updatedSchedule + updatedStartTime.
 */
export const propagationToEdits = (
  result: { updatedSchedule: ScheduleItem[]; updatedStartTime: Date },
  rows: TimesStopsRowNew[]
): PendingEdit[] =>
  rows.flatMap((row) => {
    const item = result.updatedSchedule.find((s) => s.at === row.pathStepId);
    if (!item?.arrival) return [];
    const newArrival = new Date(
      result.updatedStartTime.getTime() + Duration.parse(item.arrival).ms
    );
    if (newArrival.getTime() === row.requestedArrival?.getTime()) return [];
    return [{ rowId: row.id, field: 'requestedArrival' as const, value: newArrival }];
  });

/**
 * Rebuilds the power_restrictions API array from path step rows.
 * Each non-null powerRestriction on a path step row marks the start of a range.
 * The range extends until the next path step with an explicit value (or the last path step).
 *
 * @example
 * // rows: [{ id: 'A', powerRestriction: 'C1' }, { id: 'B', powerRestriction: null }, { id: 'C', powerRestriction: '∅' }, { id: 'D', powerRestriction: null }]
 * // → [{ from: 'A', to: 'C', value: 'C1' }, { from: 'C', to: 'D', value: '∅' }]
 *
 * // rows: [{ id: 'A', powerRestriction: null }, { id: 'B', powerRestriction: 'C2' }, { id: 'C', powerRestriction: null }]
 * // → [{ from: 'B', to: 'C', value: 'C2' }]
 */
export const buildPowerRestrictionsFromRows = (
  rows: TimesStopsRowNew[]
): PowerRestrictionItem[] => {
  const pathStepRows = rows.filter((r) => r.pathStepId);
  const result: PowerRestrictionItem[] = [];

  for (let i = 0; i < pathStepRows.length - 1; i++) {
    const code = pathStepRows[i].powerRestriction;
    if (!code) continue;

    const from = pathStepRows[i].pathStepId!;
    let j = i + 1;
    while (j < pathStepRows.length - 1 && !pathStepRows[j].powerRestriction) {
      j++;
    }
    const to = pathStepRows[j].pathStepId!;
    result.push({ from, to, value: code });
  }

  return result;
};

/** Build a TrainSchedule object from a Train with updated path and schedule. */
export const buildUpdatedOccurrence = ({
  selectedTrain,
  updatedPath,
  updatedSchedule,
  trainName,
  powerRestrictions,
}: {
  selectedTrain: Train;
  updatedPath: PathItem[];
  updatedSchedule: ScheduleItem[];
  trainName: string;
  powerRestrictions?: PowerRestrictionItem[];
}): TrainSchedule => ({
  category: selectedTrain.category,
  comfort: selectedTrain.comfort,
  constraint_distribution: selectedTrain.constraint_distribution,
  initial_speed: selectedTrain.initial_speed,
  labels: selectedTrain.labels,
  margins: selectedTrain.margins,
  options: selectedTrain.options,
  path: updatedPath,
  power_restrictions: powerRestrictions ?? selectedTrain.power_restrictions,
  rolling_stock_name: selectedTrain.rolling_stock_name,
  schedule: updatedSchedule,
  speed_limit_tag: selectedTrain.speed_limit_tag,
  start_time: selectedTrain.start_time,
  train_name: trainName,
});
