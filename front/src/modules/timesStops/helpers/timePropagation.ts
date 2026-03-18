import type { PathItem, ScheduleItem } from 'common/api/osrdEditoastApi';
import type { Train } from 'reducers/osrdconf/types';
import { Duration } from 'utils/duration';

import { TIME_PROPAGATION_DEFAULT_DELTA } from '../consts';
import type { ArrivalUpdate, CellUpdate, DepartureUpdate } from '../types';

type PropagationResult = {
  updatedPath: PathItem[];
  updatedSchedule: ScheduleItem[];
  updatedStartTime: Date;
};

/**
 * Computes the delta in milliseconds between two times.
 */
export const computeTimeDeltaMs = (oldValue: Date | null, newValue: Date | null): number | null => {
  if (!oldValue || !newValue) return null;
  return Duration.subtractDate(newValue, oldValue).ms;
};

/**
 * Formats a delta between two times using +/-HH:MM:SS.
 */
export const formatPropagationDeltaLabel = (
  oldValue: Date | null,
  newValue: Date | null
): string => {
  const deltaMs = computeTimeDeltaMs(oldValue, newValue);
  if (deltaMs === null) return TIME_PROPAGATION_DEFAULT_DELTA;

  const sign = deltaMs >= 0 ? '+' : '-';
  const totalSeconds = Math.round(new Duration({ milliseconds: deltaMs }).abs().total('second'));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return `${sign}${hours.toString().padStart(2, '0')}:${minutes
    .toString()
    .padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

/**
 * Propagate a time edit along the path.
 * - toDestination: adds delta to arrivals from the edited point and after.
 * - fromDeparture: shifts start_time by +delta and arrivals after by -delta (they cancel out,
 *   so only the edited point and everything before it actually moves).
 */
const propagateFromEditedPoint = (
  oldValue: Date | null,
  newValue: Date | null,
  editedPathStepId: string,
  selectedTrain: Train,
  direction: 'fromDeparture' | 'toDestination'
): PropagationResult | undefined => {
  const deltaMs = computeTimeDeltaMs(oldValue, newValue);
  if (deltaMs === null) return undefined;

  const editedPathIndex = selectedTrain.path.findIndex((step) => step.id === editedPathStepId);
  if (editedPathIndex < 0) return undefined;

  const updatedSchedule = (selectedTrain.schedule ?? []).map((item) => {
    const itemPathIndex = selectedTrain.path.findIndex((step) => step.id === item.at);
    if (item.arrival == null) return item;

    const isAffectedByDelta =
      direction === 'fromDeparture'
        ? itemPathIndex > editedPathIndex
        : itemPathIndex >= editedPathIndex;

    if (!isAffectedByDelta) return item;

    return {
      ...item,
      arrival: new Duration({
        milliseconds:
          Duration.parse(item.arrival).ms + (direction === 'fromDeparture' ? -deltaMs : deltaMs),
      }).toISOString(),
    };
  });

  const startTimeMs = new Date(selectedTrain.start_time).getTime();

  return {
    updatedPath: selectedTrain.path,
    updatedSchedule,
    updatedStartTime: new Date(direction === 'fromDeparture' ? startTimeMs + deltaMs : startTimeMs),
  };
};

const propagateShiftAll = (
  oldValue: Date | null,
  newValue: Date | null,
  selectedTrain: Train
): PropagationResult | undefined => {
  const deltaMs = computeTimeDeltaMs(oldValue, newValue);
  if (deltaMs === null) return undefined;

  const currentStartTime = new Date(selectedTrain.start_time);
  return {
    updatedPath: selectedTrain.path,
    updatedSchedule: selectedTrain.schedule ?? [],
    updatedStartTime: new Date(currentStartTime.getTime() + deltaMs),
  };
};

const propagateByMode = (
  oldValue: Date | null,
  newValue: Date | null,
  update: ArrivalUpdate | DepartureUpdate,
  selectedTrain: Train
): PropagationResult | undefined => {
  if (update.propagationMode === 'toAllWaypoints') {
    return propagateShiftAll(oldValue, newValue, selectedTrain);
  }
  if (
    (update.propagationMode === 'fromDeparture' || update.propagationMode === 'toDestination') &&
    update.row.isPathStep
  ) {
    return propagateFromEditedPoint(
      oldValue,
      newValue,
      update.row.id,
      selectedTrain,
      update.propagationMode
    );
  }
  return undefined;
};

export const propagateTime = (
  update: CellUpdate,
  selectedTrain: Train
): PropagationResult | undefined => {
  switch (update.field) {
    case 'requestedArrival':
      return propagateByMode(update.row.requestedArrival, update.value, update, selectedTrain);
    case 'requestedDeparture':
      return propagateByMode(update.row.requestedDeparture, update.value, update, selectedTrain);
    default:
      return undefined;
  }
};
