import type { ScheduleItem, TimetableType } from 'common/api/osrdEditoastApi';
import type { Train } from 'reducers/osrdconf/types';
import {
  Duration,
  type StartTime,
  addDurationToStartTime,
  subtractStartTime,
} from 'utils/duration';

import type { ArrivalUpdate, CellUpdate, PropagationMode, PropagationResult } from '../types';
import { cascadeArrivals } from './arrivalCascade';
import { propagateStopDuration } from './stopDurationPropagation';
import { truncateStartTimeToSecond, formatSignedDelta } from './utils';

const isOriginArrivalUpdate = (update: CellUpdate): update is ArrivalUpdate =>
  update.field === 'requestedArrival' && update.row.opOnPathIndex === 0;

const toHmsDuration = (date: StartTime) =>
  date instanceof Date
    ? new Duration({
        hours: date.getHours(),
        minutes: date.getMinutes(),
        seconds: date.getSeconds(),
      })
    : new Duration({ seconds: Math.floor(date.total('second')) });

// Delta based on HH:mm:ss only. Ignores the calendar day.
const computeDelta = (oldValue: StartTime | null, newValue: StartTime | null): Duration | null => {
  if (!oldValue || !newValue) return null;
  return toHmsDuration(newValue).sub(toHmsDuration(oldValue));
};

const computeDeltaForPropagationMode = (
  oldValue: StartTime | null,
  newValue: StartTime | null,
  mode: PropagationMode
): Duration | null =>
  mode === 'shiftAllWaypoints' || mode === 'fromDeparture'
    ? computeDelta(oldValue, newValue)
    : oldValue && newValue
      ? subtractStartTime(truncateStartTimeToSecond(newValue), truncateStartTimeToSecond(oldValue))
      : null;

export const formatPropagationDeltaLabelByMode = (
  oldValue: Date | null,
  newValue: Date | null,
  mode: PropagationMode,
  isOriginArrival = false
): string => {
  // At the origin arrival, propagation always uses HH:mm:ss delta (start_time shift),
  // regardless of mode, to keep the label consistent with the actual propagation.
  const delta = isOriginArrival
    ? computeDelta(oldValue, newValue)
    : computeDeltaForPropagationMode(oldValue, newValue, mode);
  return formatSignedDelta(delta ?? Duration.zero);
};

/**
 * Propagate a time edit along the path.
 * - toDestination: adds delta to arrivals from the edited point and after.
 * - fromDeparture: shifts start_time by +delta and arrivals after by -delta (they cancel out,
 *   so only the edited point and everything before it actually moves).
 * In both cases, steps are processed in path order and any step that ends up before the previous
 * one is bumped by 24h.
 */
const propagateFromEditedPoint = (
  delta: Duration,
  editedPathStepId: string,
  selectedTrain: Train,
  direction: 'fromDeparture' | 'toDestination',
  timetableType: TimetableType
): PropagationResult | undefined => {
  // Delta strategy by direction:
  // - fromDeparture: compare time-of-day only
  // - toDestination: compare full date-time (can produce D+1)
  const editedPathIndex = selectedTrain.path.findIndex((step) => step.id === editedPathStepId);
  if (editedPathIndex < 0) return undefined;

  const currentStartTime =
    timetableType === 'CALENDAR'
      ? new Date(selectedTrain.start_time)
      : new Duration({ milliseconds: selectedTrain.start_time });
  const isFromDeparture = direction === 'fromDeparture';
  // For fromDeparture: the train's start time shifts by delta. For toDestination: it stays the same.
  const newStartTime = isFromDeparture
    ? addDurationToStartTime(currentStartTime, delta)
    : currentStartTime;

  // For fromDeparture: the edited item is excluded from the cascade, but its offset is the baseline —
  // any shifted offset that falls before it gets +24h.
  // For toDestination: the edited item is part of the cascade, so the baseline is 0.
  const editedItem = selectedTrain.schedule?.find((item) => item.at === editedPathStepId);
  const editedOldOffset = editedItem?.arrival ? Duration.parse(editedItem.arrival) : null;

  const updatedSchedule = cascadeArrivals({
    schedule: selectedTrain.schedule ?? [],
    path: selectedTrain.path,
    fromPathIndex: isFromDeparture ? editedPathIndex + 1 : editedPathIndex,
    baseline: (isFromDeparture ? editedOldOffset : null) ?? Duration.zero,
    shift: (arrival) => (isFromDeparture ? arrival.sub(delta) : arrival.add(delta)),
  });

  return {
    updatedPath: selectedTrain.path,
    updatedSchedule,
    updatedStartTime: newStartTime,
  };
};

const propagateShiftAll = (
  delta: Duration,
  selectedTrain: Train,
  timetableType: TimetableType
): PropagationResult | undefined => {
  const currentStartTime =
    timetableType === 'CALENDAR'
      ? new Date(selectedTrain.start_time)
      : new Duration({ milliseconds: selectedTrain.start_time });
  return {
    updatedPath: selectedTrain.path,
    updatedSchedule: selectedTrain.schedule ?? [],
    updatedStartTime: addDurationToStartTime(currentStartTime, delta),
  };
};

/**
 * For atThisWaypoint: waypoints after the edited point that now fall before it in time
 * must be on the next day.
 */
export const adjustFollowingWaypointsForMidnight = (
  newValue: Date,
  editedPathStepId: string,
  selectedTrain: Train
): ScheduleItem[] => {
  const startTime = new Date(selectedTrain.start_time);
  const editedPathIndex = selectedTrain.path.findIndex((step) => step.id === editedPathStepId);

  return cascadeArrivals({
    schedule: selectedTrain.schedule ?? [],
    path: selectedTrain.path,
    fromPathIndex: editedPathIndex + 1,
    baseline: Duration.subtractDate(newValue, startTime),
  });
};

export const propagateTime = (
  update: CellUpdate,
  selectedTrain: Train,
  timetableType: TimetableType
): PropagationResult | undefined => {
  if (update.field !== 'requestedArrival' && update.field !== 'requestedDeparture')
    return undefined;

  const oldValue = update.row[update.field];
  const newValue = update.value;
  const isOriginArrival = isOriginArrivalUpdate(update);
  const isShiftAllPropagation = update.propagationMode === 'shiftAllWaypoints';
  // Origin and shiftAll use HH:mm:ss delta only. toDestination uses full datetime (can produce D+1).
  // fromDeparture uses HH:mm:ss only since start_time absorbs the shift.
  const delta =
    isOriginArrival || isShiftAllPropagation
      ? computeDelta(oldValue, newValue)
      : computeDeltaForPropagationMode(oldValue, newValue, update.propagationMode);
  if (delta === null) return undefined;

  // A departure update propagated toDestination is the same delta applied to the stop duration.
  if (update.field === 'requestedDeparture' && update.propagationMode === 'toDestination') {
    return propagateStopDuration(
      {
        row: update.row,
        field: 'stopDuration',
        value: (update.row.stopDuration ?? Duration.zero).add(delta).total('second'),
        propagationMode: 'toDestination',
      },
      selectedTrain,
      timetableType
    );
  }

  if (isOriginArrival || update.propagationMode === 'shiftAllWaypoints') {
    if (!isOriginArrival) return propagateShiftAll(delta, selectedTrain, timetableType);
    let result: PropagationResult | undefined;
    if (isShiftAllPropagation || update.propagationMode === 'toDestination')
      result = propagateShiftAll(delta, selectedTrain, timetableType);
    // atThisWaypoint at origin = only move start_time. Following offsets are compensated so
    // their absolute times stay the same — which is exactly what fromDeparture does.
    else if (update.propagationMode === 'atThisWaypoint')
      result = propagateFromEditedPoint(
        delta,
        update.row.pathStepId!,
        selectedTrain,
        'fromDeparture',
        timetableType
      );
    // Keep the computed start time: the typed value's day is only inferred from HH:mm:ss
    // Truncate the sub-second part inherited from start_time.
    return result
      ? { ...result, updatedStartTime: truncateStartTimeToSecond(result.updatedStartTime) }
      : result;
  }

  if (update.propagationMode === 'atThisWaypoint' || !update.row.pathStepId) return undefined;
  return propagateFromEditedPoint(
    delta,
    update.row.pathStepId,
    selectedTrain,
    update.propagationMode,
    timetableType
  );
};
