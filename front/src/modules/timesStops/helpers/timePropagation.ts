import type { PathItem, ScheduleItem } from 'common/api/osrdEditoastApi';
import type { Train } from 'reducers/osrdconf/types';
import { addDurationToDate, Duration } from 'utils/duration';

import type { ArrivalUpdate, CellUpdate, DepartureUpdate, PropagationMode } from '../types';

type PropagationResult = {
  updatedPath: PathItem[];
  updatedSchedule: ScheduleItem[];
  updatedStartTime: Date;
};

const toHmsDuration = (date: Date) =>
  new Duration({
    hours: date.getHours(),
    minutes: date.getMinutes(),
    seconds: date.getSeconds(),
  });

// Delta based on HH:mm:ss only. Ignores the calendar day.
const computeDelta = (oldValue: Date | null, newValue: Date | null): Duration | null => {
  if (!oldValue || !newValue) return null;
  return toHmsDuration(newValue).sub(toHmsDuration(oldValue));
};

const computeDeltaForPropagationMode = (
  oldValue: Date | null,
  newValue: Date | null,
  mode: PropagationMode
): Duration | null =>
  mode === 'shiftAllWaypoints' || mode === 'fromDeparture'
    ? computeDelta(oldValue, newValue)
    : oldValue && newValue
      ? Duration.subtractDate(newValue, oldValue)
      : null;

const formatSignedDelta = (delta: Duration) => {
  const sign = delta.ms >= 0 ? '+' : '-';
  const absoluteDelta = delta.abs().round('second');
  const hours = Math.floor(absoluteDelta.total('hour'));
  const minutes = Math.floor(absoluteDelta.total('minute')) % 60;
  const seconds = Math.floor(absoluteDelta.total('second')) % 60;

  const hoursLabel = hours.toString().padStart(2, '0');
  const minutesLabel = minutes.toString().padStart(2, '0');
  const secondsLabel = seconds.toString().padStart(2, '0');

  return `${sign}${hoursLabel}:${minutesLabel}:${secondsLabel}`;
};

export const formatPropagationDeltaLabelByMode = (
  oldValue: Date | null,
  newValue: Date | null,
  mode: PropagationMode
): string => {
  const delta = computeDeltaForPropagationMode(oldValue, newValue, mode) ?? Duration.zero;
  return formatSignedDelta(delta);
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
  // Delta strategy by direction:
  // - fromDeparture: compare time-of-day only
  // - toDestination: compare full date-time (can produce D+1)
  const delta = computeDeltaForPropagationMode(oldValue, newValue, direction);
  if (delta === null) return undefined;

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

    const oldArrival = Duration.parse(item.arrival);
    const newArrival =
      direction === 'fromDeparture' ? oldArrival.sub(delta) : oldArrival.add(delta);

    return {
      ...item,
      arrival: newArrival.toISOString(),
    };
  });

  const currentStartTime = new Date(selectedTrain.start_time);

  return {
    updatedPath: selectedTrain.path,
    updatedSchedule,
    updatedStartTime:
      direction === 'fromDeparture' ? addDurationToDate(currentStartTime, delta) : currentStartTime,
  };
};

const propagateShiftAll = (
  oldValue: Date | null,
  newValue: Date | null,
  selectedTrain: Train
): PropagationResult | undefined => {
  const delta = computeDelta(oldValue, newValue);
  if (delta === null) return undefined;

  const currentStartTime = new Date(selectedTrain.start_time);
  return {
    updatedPath: selectedTrain.path,
    updatedSchedule: selectedTrain.schedule ?? [],
    updatedStartTime: addDurationToDate(currentStartTime, delta),
  };
};

const propagateByMode = (
  oldValue: Date | null,
  newValue: Date | null,
  update: ArrivalUpdate | DepartureUpdate,
  selectedTrain: Train
): PropagationResult | undefined => {
  if (update.propagationMode === 'shiftAllWaypoints') {
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
