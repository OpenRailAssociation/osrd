import type { ScheduleItem, TimetableType } from 'common/api/osrdEditoastApi';
import type { Train } from 'reducers/osrdconf/types';
import { Duration, subtractDurationFromStartTime } from 'utils/duration';

import type { StopDurationUpdate, PropagationResult } from '../types';
import { cascadeArrivals } from './arrivalCascade';
import { insertScheduleItemInOrder } from './cellUpdate';
import { formatSignedDelta } from './utils';

export const formatStopDurationDeltaLabel = (
  oldValue: Duration | null,
  newValue: Duration | null
): string => formatSignedDelta((newValue ?? Duration.zero).sub(oldValue ?? Duration.zero));

/**
 * Propagate a stop-duration edit along the path.
 * - Edited point's own arrival: never touched.
 * - toDestination: arrivals after, +delta.
 * - fromDeparture: start_time, -delta too; edited point and everything before, free ride;
 *   arrivals after, +delta to cancel the start_time shift back out.
 * - Day crossing: +24h bump.
 * - No previous duration: treated as 0.
 */
export const propagateStopDuration = (
  update: StopDurationUpdate,
  selectedTrain: Train,
  timetableType: TimetableType
): PropagationResult | undefined => {
  // Clearing the duration falls through to the generic single-row edit path, regardless of mode.
  if (
    update.propagationMode === 'atThisWaypoint' ||
    !update.row.pathStepId ||
    update.value === null
  )
    return undefined;

  const pathStepId = update.row.pathStepId;
  const editedPathIndex = selectedTrain.path.findIndex((step) => step.id === pathStepId);
  if (editedPathIndex < 0) return undefined;

  // Delta between the old and new stop duration — drives every shift below.
  const oldDuration = update.row.stopDuration ?? Duration.zero;
  const newDuration = new Duration({ seconds: update.value });
  const delta = newDuration.sub(oldDuration);

  // The edited point's current schedule state, if it already has one.
  const currentSchedule = selectedTrain.schedule ?? [];
  const editedItem = currentSchedule.find((item) => item.at === pathStepId);
  const currentStartTime =
    timetableType === 'CALENDAR'
      ? new Date(selectedTrain.start_time)
      : new Duration({ milliseconds: selectedTrain.start_time });

  // Shift every scheduled arrival after the edited point by +delta, in path order. Bump +24h
  // if a shifted arrival ends up before the previous one.
  // Then set the edited point's new duration (its arrival stays the same).
  const shiftedSchedule = cascadeArrivals({
    schedule: currentSchedule,
    path: selectedTrain.path,
    fromPathIndex: editedPathIndex + 1,
    shift: (arrival) => arrival.add(delta),
  });

  const updatedSchedule: ScheduleItem[] = editedItem
    ? shiftedSchedule.map((item) =>
        item.at === pathStepId ? { ...item, stop_for: newDuration.toISOString() } : item
      )
    : insertScheduleItemInOrder(
        shiftedSchedule,
        { at: pathStepId, arrival: null, stop_for: newDuration.toISOString() },
        selectedTrain.path
      );

  const updatedStartTime =
    update.propagationMode === 'fromDeparture'
      ? subtractDurationFromStartTime(currentStartTime, delta)
      : currentStartTime;

  return {
    updatedPath: selectedTrain.path,
    updatedSchedule,
    updatedStartTime,
  };
};
