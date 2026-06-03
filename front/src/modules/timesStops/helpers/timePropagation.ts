import type { PathItem, ScheduleItem } from 'common/api/osrdEditoastApi';
import type { Train } from 'reducers/osrdconf/types';
import { addDurationToDate, Duration } from 'utils/duration';

import type { ArrivalUpdate, CellUpdate, PropagationMode } from '../types';

const ONE_DAY = new Duration({ hours: 24 });

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

const truncateToSecond = (date: Date): Date => {
  const truncated = new Date(date);
  truncated.setMilliseconds(0);
  return truncated;
};

const computeDeltaForPropagationMode = (
  oldValue: Date | null,
  newValue: Date | null,
  mode: PropagationMode
): Duration | null =>
  mode === 'shiftAllWaypoints' || mode === 'fromDeparture'
    ? computeDelta(oldValue, newValue)
    : oldValue && newValue
      ? Duration.subtractDate(truncateToSecond(newValue), truncateToSecond(oldValue))
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
  mode: PropagationMode,
  isOrigin = false
): string => {
  // At the origin, propagation always uses HH:mm:ss delta (start_time shift),
  // regardless of mode, to keep the label consistent with the actual propagation.
  const delta = isOrigin
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
  direction: 'fromDeparture' | 'toDestination'
): PropagationResult | undefined => {
  // Delta strategy by direction:
  // - fromDeparture: compare time-of-day only
  // - toDestination: compare full date-time (can produce D+1)
  const editedPathIndex = selectedTrain.path.findIndex((step) => step.id === editedPathStepId);
  if (editedPathIndex < 0) return undefined;

  const currentStartTime = new Date(selectedTrain.start_time);
  // For fromDeparture: the train's start time shifts by delta. For toDestination: it stays the same.
  const newStartTime =
    direction === 'fromDeparture' ? addDurationToDate(currentStartTime, delta) : currentStartTime;

  // Compute shifted offsets for all affected items, sorted by path order.
  const affectedItems = Iterator.from(selectedTrain.schedule ?? [])
    .map((item) => ({
      item,
      pathIndex: selectedTrain.path.findIndex((step) => step.id === item.at),
    }))
    .filter(({ item, pathIndex }) => {
      if (item.arrival === null) return false;
      return direction === 'fromDeparture'
        ? pathIndex > editedPathIndex
        : pathIndex >= editedPathIndex;
    })
    .toArray();

  // Apply cascade: each waypoint is compared against the previous one.
  // If it falls before, it crossed midnight and gets +24h.
  // For fromDeparture: the edited item is excluded from the loop, but its offset is the baseline —
  // any shifted offset that falls before it gets +24h.
  // For toDestination: the edited item is included in the loop, so start at 0.
  const editedItem = selectedTrain.schedule?.find((item) => item.at === editedPathStepId);
  const editedOldOffset = editedItem?.arrival ? Duration.parse(editedItem.arrival) : null;
  let lastOffset =
    direction === 'fromDeparture' && editedOldOffset !== null
      ? editedOldOffset
      : new Duration({ seconds: 0 });
  const adjustments = new Map<string, string>();

  for (const { item } of affectedItems) {
    const shifted =
      direction === 'fromDeparture'
        ? Duration.parse(item.arrival!).sub(delta)
        : Duration.parse(item.arrival!).add(delta);
    const adjustedArrival = shifted.ms < lastOffset.ms ? shifted.add(ONE_DAY) : shifted;
    adjustments.set(item.at, adjustedArrival.toISOString());
    lastOffset = adjustedArrival;
  }

  const updatedSchedule = (selectedTrain.schedule ?? []).map((item) =>
    adjustments.has(item.at) ? { ...item, arrival: adjustments.get(item.at) } : item
  );

  return {
    updatedPath: selectedTrain.path,
    updatedSchedule,
    updatedStartTime: newStartTime,
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

  const itemsAfterUpdatedStep = Iterator.from(selectedTrain.schedule ?? [])
    .map((item) => ({
      item,
      pathIndex: selectedTrain.path.findIndex((step) => step.id === item.at),
    }))
    .filter(({ item, pathIndex }) => item.arrival && pathIndex > editedPathIndex)
    .toArray();

  let lastOffset = Duration.subtractDate(newValue, startTime);
  const adjustments = new Map<string, string>();

  for (const { item } of itemsAfterUpdatedStep) {
    const itemOffset = Duration.parse(item.arrival!);
    const adjustedArrival = itemOffset.ms < lastOffset.ms ? itemOffset.add(ONE_DAY) : itemOffset;
    adjustments.set(item.at, adjustedArrival.toISOString());
    lastOffset = adjustedArrival;
  }

  return (selectedTrain.schedule ?? []).map((item) =>
    adjustments.has(item.at) ? { ...item, arrival: adjustments.get(item.at) } : item
  );
};

export const propagateTime = (
  update: CellUpdate,
  selectedTrain: Train
): PropagationResult | undefined => {
  if (update.field !== 'requestedArrival' && update.field !== 'requestedDeparture')
    return undefined;

  const oldValue = update.row[update.field];
  const newValue = update.value;
  const isOriginUpdate = isOriginArrivalUpdate(update);
  const isShiftAllPropagation = update.propagationMode === 'shiftAllWaypoints';
  // Origin and shiftAll use HH:mm:ss delta only. toDestination uses full datetime (can produce D+1).
  // fromDeparture uses HH:mm:ss only since start_time absorbs the shift.
  const delta =
    isOriginUpdate || isShiftAllPropagation
      ? computeDelta(oldValue, newValue)
      : computeDeltaForPropagationMode(oldValue, newValue, update.propagationMode);
  if (delta === null) return undefined;

  if (isOriginUpdate || update.propagationMode === 'shiftAllWaypoints') {
    if (!isOriginUpdate) return propagateShiftAll(delta, selectedTrain);
    if (isShiftAllPropagation || update.propagationMode === 'toDestination')
      return propagateShiftAll(delta, selectedTrain);
    // atThisWaypoint at origin = only move start_time. Following offsets are compensated so
    // their absolute times stay the same — which is exactly what fromDeparture does.
    if (update.propagationMode === 'atThisWaypoint')
      return propagateFromEditedPoint(
        delta,
        update.row.pathStepId!,
        selectedTrain,
        'fromDeparture'
      );
    return undefined;
  }

  if (update.propagationMode === 'atThisWaypoint' || !update.row.pathStepId) return undefined;
  return propagateFromEditedPoint(
    delta,
    update.row.pathStepId,
    selectedTrain,
    update.propagationMode
  );
};
