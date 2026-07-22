import type { ScheduleItem } from 'common/api/osrdEditoastApi';
import type { Train } from 'reducers/osrdconf/types';
import { Duration } from 'utils/duration';

import type { StopDurationUpdate } from '../types';
import { insertScheduleItemInOrder } from './cellUpdate';
import { formatSignedDelta, type PropagationResult } from './timePropagation';

const ONE_DAY = new Duration({ hours: 24 });
// Large enough that the day-bump comparison below never triggers when there's no arrival to anchor on.
const NO_ANCHOR_OFFSET = new Duration({ hours: 24 * 1000 });

export const formatStopDurationDeltaLabel = (
  oldValue: Duration | null,
  newValue: Duration | null
): string => formatSignedDelta((newValue ?? Duration.zero).sub(oldValue ?? Duration.zero));

/**
 * Propagate a stop-duration edit along the path.
 * - toDestination: arrivals after the edited point shift by +delta. The edited point's own
 *   arrival is unchanged.
 * - fromDeparture: arrivals before the edited point shift by -delta, and so does the edited
 *   point's own arrival if it has one (its departure ends up unchanged).
 * A brand new stop duration propagates against an old value of 0. In both directions, steps are
 * processed in path order and any step out of order relative to the previous one is bumped by
 * +/-24h.
 */
export const propagateStopDuration = (
  update: StopDurationUpdate,
  selectedTrain: Train
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

  const oldDuration = update.row.stopDuration ?? Duration.zero;
  const newDuration = new Duration({ seconds: update.value });
  const delta = newDuration.sub(oldDuration);

  const currentSchedule = selectedTrain.schedule ?? [];
  const editedItem = currentSchedule.find((item) => item.at === pathStepId);
  const editedOffset = editedItem?.arrival ? Duration.parse(editedItem.arrival) : null;

  const itemsWithPathIndex = currentSchedule
    .map((item) => ({
      item,
      pathIndex: selectedTrain.path.findIndex((step) => step.id === item.at),
    }))
    .filter(({ item, pathIndex }) => !!item.arrival && pathIndex >= 0);

  // A preceding stop can't be shifted before departure — clamp instead of bumping a day.
  const clampToDeparture = (offset: Duration) => (offset.ms < 0 ? Duration.zero : offset);
  const editedNewOffset = editedOffset !== null ? clampToDeparture(editedOffset.sub(delta)) : null;

  const adjustments = new Map<string, string>();

  if (update.propagationMode === 'toDestination') {
    const affectedItems = itemsWithPathIndex
      .filter(({ pathIndex }) => pathIndex > editedPathIndex)
      .sort((a, b) => a.pathIndex - b.pathIndex);

    let lastOffset = editedOffset ?? new Duration({ seconds: 0 });
    for (const { item } of affectedItems) {
      const shifted = Duration.parse(item.arrival!).add(delta);
      const adjusted = shifted.ms < lastOffset.ms ? shifted.add(ONE_DAY) : shifted;
      adjustments.set(item.at, adjusted.toISOString());
      lastOffset = adjusted;
    }
  } else {
    // fromDeparture: walk back toward the origin, closest point first.
    const affectedItems = itemsWithPathIndex
      .filter(({ pathIndex }) => pathIndex < editedPathIndex)
      .sort((a, b) => b.pathIndex - a.pathIndex);

    let lastOffset = editedNewOffset ?? NO_ANCHOR_OFFSET;
    for (const { item } of affectedItems) {
      const shifted = Duration.parse(item.arrival!).sub(delta);
      const adjusted = clampToDeparture(
        shifted.ms > lastOffset.ms ? shifted.sub(ONE_DAY) : shifted
      );
      adjustments.set(item.at, adjusted.toISOString());
      lastOffset = adjusted;
    }
  }

  const editedNewArrival =
    update.propagationMode === 'fromDeparture' && editedNewOffset !== null
      ? editedNewOffset.toISOString()
      : editedItem?.arrival;

  const shiftedSchedule = currentSchedule.map((item) =>
    adjustments.has(item.at) ? { ...item, arrival: adjustments.get(item.at) } : item
  );

  const updatedSchedule: ScheduleItem[] = editedItem
    ? shiftedSchedule.map((item) =>
        item.at === pathStepId
          ? {
              ...item,
              stop_for: newDuration.toISOString(),
              ...(editedNewArrival ? { arrival: editedNewArrival } : {}),
            }
          : item
      )
    : insertScheduleItemInOrder(
        shiftedSchedule,
        { at: pathStepId, stop_for: newDuration.toISOString() },
        selectedTrain.path
      );

  return {
    updatedPath: selectedTrain.path,
    updatedSchedule,
    updatedStartTime: new Date(selectedTrain.start_time),
  };
};
