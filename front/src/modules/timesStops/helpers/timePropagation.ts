import type { PathItem, ScheduleItem } from 'common/api/osrdEditoastApi';
import type { Train } from 'reducers/osrdconf/types';
import { addDurationToDate, Duration } from 'utils/duration';

import type { ArrivalUpdate, CellUpdate, PropagationMode } from '../types';

export type PropagationResult = {
  updatedPath: PathItem[];
  updatedSchedule: ScheduleItem[];
  updatedStartTime: Date;
};

const isOriginArrivalUpdate = (update: CellUpdate): update is ArrivalUpdate =>
  update.field === 'requestedArrival' && update.row.opOnPathIndex === 0;

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
  delta: Duration,
  editedPathStepId: string,
  selectedTrain: Train,
  direction: 'fromDeparture' | 'toDestination'
): PropagationResult | undefined => {
  // Delta strategy by direction:
  // - fromDeparture: compare time-of-day only
  // - toDestination: compare full date-time (can produce D+1)
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
  delta: Duration,
  selectedTrain: Train
): PropagationResult | undefined => {
  const currentStartTime = new Date(selectedTrain.start_time);
  return {
    updatedPath: selectedTrain.path,
    updatedSchedule: selectedTrain.schedule ?? [],
    updatedStartTime: addDurationToDate(currentStartTime, delta),
  };
};

export const propagateTime = (
  update: CellUpdate,
  selectedTrain: Train
): PropagationResult | undefined => {
  if (update.field !== 'requestedArrival' && update.field !== 'requestedDeparture')
    return undefined;

  const delta = computeDelta(update.row[update.field], update.value);
  if (delta === null) return undefined;

  if (isOriginArrivalUpdate(update)) {
    if (update.propagationMode === 'toDestination') return propagateShiftAll(delta, selectedTrain);
    if (update.propagationMode === 'atThisWaypoint')
      return propagateFromEditedPoint(delta, update.row.id, selectedTrain, 'fromDeparture');
  }

  if (update.propagationMode === 'shiftAllWaypoints')
    return propagateShiftAll(delta, selectedTrain);

  if (update.propagationMode === 'atThisWaypoint' || !update.row.isPathStep) return undefined;

  return propagateFromEditedPoint(delta, update.row.id, selectedTrain, update.propagationMode);
};
