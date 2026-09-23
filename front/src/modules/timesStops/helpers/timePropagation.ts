import type { TimetableType } from 'common/api/osrdEditoastApi';
import type { Train } from 'reducers/osrdconf/types';
import {
  Duration,
  type StartTime,
  addDurationToStartTime,
  subtractStartTime,
} from 'utils/duration';

import type { BatchTimesUpdate, CellUpdate, PropagationMode, PropagationResult } from '../types';
import { cascadeArrivals } from './arrivalCascade';
import { propagateStopDuration } from './stopDurationPropagation';
import {
  formatSignedDelta,
  getTruncatedToSecondSchedule,
  getTruncatedToSecondStartTime,
} from './utils';

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
  // At the origin arrival, or for shiftAll and fromDeparture, only HH:mm:ss is compared (start_time absorbs the shift).
  // For atThisWaypoint and toDestination, full date-times are compared, so it can produce a D+1.
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

/**
 * Move the waypoint as a block: arrival and departure move, stop duration is kept.
 */
const applyAtThisWaypoint = (
  delta: Duration,
  editedPathStepId: string,
  selectedTrain: Train,
  timetableType: TimetableType
): PropagationResult | undefined => {
  const editedPathIndex = selectedTrain.path.findIndex((step) => step.id === editedPathStepId);
  if (editedPathIndex < 0) return undefined;

  const editedSchedule = (selectedTrain.schedule ?? []).map((item) =>
    item.at === editedPathStepId && item.arrival
      ? { ...item, arrival: getTruncatedToSecondSchedule(item.arrival).add(delta).toISOString() }
      : item
  );

  return {
    updatedPath: selectedTrain.path,
    updatedSchedule: cascadeArrivals({
      schedule: editedSchedule,
      path: selectedTrain.path,
      fromPathIndex: editedPathIndex,
    }),
    updatedStartTime: getTruncatedToSecondStartTime(selectedTrain, timetableType),
  };
};

const propagateShiftAll = (
  delta: Duration,
  selectedTrain: Train,
  timetableType: TimetableType
): PropagationResult => {
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

  const { pathStepId, stopDuration, opOnPathIndex } = update.row;
  const isArrivalUpdate = update.field === 'requestedArrival';
  const isOrigin = opOnPathIndex === 0;
  const delta = computeDeltaForPropagationMode(
    update.row[update.field],
    update.value,
    update.propagationMode,
    isArrivalUpdate && isOrigin
  );
  if (delta === null || !pathStepId) return undefined;

  switch (update.propagationMode) {
    case 'shiftAllWaypoints':
      return propagateShiftAll(delta, selectedTrain, timetableType);

    case 'toDestination':
      // A departure update propagated toDestination is the same delta applied to the stop duration.
      if (!isArrivalUpdate)
        return propagateStopDuration(
          {
            row: update.row,
            field: 'stopDuration',
            value: (stopDuration ?? Duration.zero).add(delta).total('second'),
            propagationMode: 'toDestination',
          },
          selectedTrain,
          timetableType
        );

      // At the origin the arrival is start_time, so moving it along with everything after it moves the whole train.
      return isOrigin
        ? propagateShiftAll(delta, selectedTrain, timetableType)
        : propagateFromEditedPoint(
            delta,
            pathStepId,
            selectedTrain,
            'toDestination',
            timetableType
          );

    case 'fromDeparture':
      // An arrival update propagated fromDeparture is the opposite delta applied to the stop duration if it exists.
      return isArrivalUpdate && !isOrigin && stopDuration
        ? propagateStopDuration(
            {
              row: update.row,
              field: 'stopDuration',
              value: stopDuration.sub(delta).total('second'),
              propagationMode: 'fromDeparture',
            },
            selectedTrain,
            timetableType
          )
        : propagateFromEditedPoint(
            delta,
            pathStepId,
            selectedTrain,
            'fromDeparture',
            timetableType
          );

    case 'atThisWaypoint':
      // At origin, the point only moves start_time. Following offsets are compensated so their
      // absolute times stay the same — which is exactly what fromDeparture does.
      if (isOrigin)
        return propagateFromEditedPoint(
          delta,
          pathStepId,
          selectedTrain,
          'fromDeparture',
          timetableType
        );

      // Anywhere else, an arrival update changes nothing but its own cell, so it is left to the
      // generic single-row edit, while a departure update takes the arrival along with it.
      return isArrivalUpdate
        ? undefined
        : applyAtThisWaypoint(delta, pathStepId, selectedTrain, timetableType);
  }
};
