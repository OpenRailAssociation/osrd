import type { TimetableType } from 'common/api/osrdEditoastApi';
import type { Train } from 'reducers/osrdconf/types';
import {
  Duration,
  type StartTime,
  addDurationToStartTime,
  subtractStartTime,
} from 'utils/duration';

import type {
  ArrivalUpdate,
  BatchTimesUpdate,
  CellUpdate,
  PropagationMode,
  PropagationResult,
} from '../types';
import { cascadeArrivals } from './arrivalCascade';
import { propagateStopDuration } from './stopDurationPropagation';
import { formatSignedDelta, getTruncatedToSecondStartTime } from './utils';

const isOriginArrivalUpdate = (
  update: Exclude<CellUpdate, BatchTimesUpdate>
): update is ArrivalUpdate => update.field === 'requestedArrival' && update.row.opOnPathIndex === 0;

const toHmsDuration = (date: StartTime) =>
  date instanceof Date
    ? new Duration({
        hours: date.getHours(),
        minutes: date.getMinutes(),
        seconds: date.getSeconds(),
      })
    : date;

const computeDeltaForPropagationMode = (
  oldValue: StartTime | null,
  newValue: StartTime | null,
  mode: PropagationMode,
  isOriginArrival: boolean
): Duration | null => {
  if (!oldValue || !newValue) return null;
  // At the origin arrival or for shiftAll and fromDeparture compares HH:mm:ss only (start_time absorbs the shift).
  // For toDestination compares full date-times, so it can produce a D+1.
  return isOriginArrival || mode === 'shiftAllWaypoints' || mode === 'fromDeparture'
    ? toHmsDuration(newValue).sub(toHmsDuration(oldValue))
    : subtractStartTime(newValue, oldValue);
};

export const formatPropagationDeltaLabelByMode = (
  oldValue: Date | null,
  newValue: Date | null,
  mode: PropagationMode,
  isOriginArrival = false
): string =>
  formatSignedDelta(
    computeDeltaForPropagationMode(oldValue, newValue, mode, isOriginArrival) ?? Duration.zero
  );

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

  const currentStartTime = getTruncatedToSecondStartTime(selectedTrain, timetableType);
  const isFromDeparture = direction === 'fromDeparture';
  // For fromDeparture: the train's start time shifts by delta. For toDestination: it stays the same.
  const newStartTime = isFromDeparture
    ? addDurationToStartTime(currentStartTime, delta)
    : currentStartTime;

  // For fromDeparture: the edited item is excluded from the cascade.
  // For toDestination: the edited item is part of the cascade.
  const updatedSchedule = cascadeArrivals({
    schedule: selectedTrain.schedule ?? [],
    path: selectedTrain.path,
    fromPathIndex: isFromDeparture ? editedPathIndex + 1 : editedPathIndex,
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
  const currentStartTime = getTruncatedToSecondStartTime(selectedTrain, timetableType);
  return {
    updatedPath: selectedTrain.path,
    updatedSchedule: selectedTrain.schedule ?? [],
    updatedStartTime: addDurationToStartTime(currentStartTime, delta),
  };
};

export const propagateTime = (
  update: Exclude<CellUpdate, BatchTimesUpdate>,
  selectedTrain: Train,
  timetableType: TimetableType
): PropagationResult | undefined => {
  if (update.field !== 'requestedArrival' && update.field !== 'requestedDeparture')
    return undefined;

  const oldValue = update.row[update.field];
  const newValue = update.value;
  const isOriginArrival = isOriginArrivalUpdate(update);
  const isShiftAllPropagation = update.propagationMode === 'shiftAllWaypoints';
  const delta = computeDeltaForPropagationMode(
    oldValue,
    newValue,
    update.propagationMode,
    isOriginArrival
  );
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
    return result;
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
