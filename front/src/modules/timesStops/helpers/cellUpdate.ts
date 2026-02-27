import { v4 as uuidV4 } from 'uuid';

import type { TrainSchedule, PathItem, ScheduleItem } from 'common/api/osrdEditoastApi';
import type { Train } from 'reducers/osrdconf/types';
import { addElementAtIndex } from 'utils/array';
import { Duration } from 'utils/duration';

import type { CellUpdate, TimesStopsRowNew } from '../types';

/** Compute the insertion index for a new PathStep using row opOnPathIndex values. */
const computeInsertIndex = (
  editedOpIndex: number,
  allRows: TimesStopsRowNew[],
  currentPath: PathItem[]
): number => {
  // Build a map of pathStepId -> opOnPathIndex from rows that are path steps
  const pathStepOpIndices = new Map(
    allRows.filter((r) => r.isPathStep).map((r) => [r.id, r.opOnPathIndex])
  );

  // Find the first PathStep whose opOnPathIndex is greater than the edited OP's
  const foundIndex = currentPath.findIndex((step) => {
    const opIndex = pathStepOpIndices.get(step.id);
    return opIndex !== undefined && opIndex > editedOpIndex;
  });

  return foundIndex === -1 ? currentPath.length : foundIndex;
};

/** Find existing PathStep or create a new one at the correct position. */
export const upsertPathStep = (
  editedRow: TimesStopsRowNew,
  currentPath: PathItem[],
  allRows: TimesStopsRowNew[]
): { pathStepId: string; updatedPath: PathItem[] } => {
  if (editedRow.isPathStep) {
    return { pathStepId: editedRow.id, updatedPath: currentPath };
  }

  const newPathStep: PathItem = { id: uuidV4(), location: editedRow.location };
  const insertIndex = computeInsertIndex(editedRow.opOnPathIndex, allRows, currentPath);
  const updatedPath = addElementAtIndex(currentPath, insertIndex, newPathStep);

  return { pathStepId: newPathStep.id, updatedPath };
};

type BuildScheduleItemParams = {
  update: CellUpdate;
  startTime: Date;
};

/** Difference between two dates, truncated to whole seconds. */
const diffSeconds = (a: Date, b: Date) =>
  Math.floor(a.getTime() / 1000) - Math.floor(b.getTime() / 1000);

/**
 * Build a new ScheduleItem based on the field being updated.
 * Note: Day adjustment for overnight journeys is handled by TimeCell using referenceDate.
 * The dates received here are already on the correct calendar day.
 */
export const buildScheduleItemForField = ({
  update,
  startTime,
}: BuildScheduleItemParams): Partial<ScheduleItem> => {
  if (update.value === null) return {};

  switch (update.field) {
    case 'requestedArrival': {
      // TimeCell already adjusted the date using the previous row's time as reference
      return {
        arrival: new Duration({ seconds: diffSeconds(update.value, startTime) }).toISOString(),
      };
    }

    case 'stopDuration': {
      return { stop_for: new Duration({ seconds: update.value }).toISOString() };
    }

    case 'requestedDeparture': {
      const departureTime = update.value;
      const arrivalTime = update.row.requestedArrival;

      if (arrivalTime) {
        // Arrival exists => stop_for = departure - arrival
        // TimeCell already ensured departure >= arrival by using arrival as referenceDate
        return {
          stop_for: new Duration({
            seconds: diffSeconds(departureTime, arrivalTime),
          }).toISOString(),
        };
      }

      // No arrival => arrival = departure - stopDuration
      const existingStopForSeconds = update.row.stopDuration?.total('second') ?? 0;
      const newSchedule: Partial<ScheduleItem> = {
        arrival: new Duration({
          seconds: diffSeconds(departureTime, startTime) - existingStopForSeconds,
        }).toISOString(),
      };
      // Keep stop_for if there was an existing stopDuration (including PT0S)
      if (update.row.stopDuration) {
        newSchedule.stop_for = update.row.stopDuration.toISOString();
      }
      return newSchedule;
    }

    default:
      return {};
  }
};

const getPathIndex = (pathStepId: string, path: PathItem[]) =>
  path.findIndex((step) => step.id === pathStepId);

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

/** Build a TrainSchedule object from a Train with updated path and schedule. */
export const buildUpdatedOccurrence = (
  selectedTrain: Train,
  updatedPath: PathItem[],
  updatedSchedule: ScheduleItem[],
  trainName: string
): TrainSchedule => ({
  category: selectedTrain.category,
  comfort: selectedTrain.comfort,
  constraint_distribution: selectedTrain.constraint_distribution,
  initial_speed: selectedTrain.initial_speed,
  labels: selectedTrain.labels,
  margins: selectedTrain.margins,
  options: selectedTrain.options,
  path: updatedPath,
  power_restrictions: selectedTrain.power_restrictions,
  rolling_stock_name: selectedTrain.rolling_stock_name,
  schedule: updatedSchedule,
  speed_limit_tag: selectedTrain.speed_limit_tag,
  start_time: selectedTrain.start_time,
  train_name: trainName,
});
