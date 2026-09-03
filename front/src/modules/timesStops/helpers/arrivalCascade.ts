import type { PathItem, ScheduleItem } from 'common/api/osrdEditoastApi';
import { Duration } from 'utils/duration';

import { ONE_DAY } from '../consts';

/**
 * Shift the scheduled arrivals from fromPathIndex on.
 * Whole days are then added or removed,
 * so each arrival is consistent with the previous departure.
 */
export const cascadeArrivals = ({
  schedule,
  path,
  fromPathIndex,
  shift = (arrival: Duration) => arrival,
}: {
  schedule: ScheduleItem[];
  path: PathItem[];
  fromPathIndex: number;
  shift?: (arrival: Duration) => Duration;
}): ScheduleItem[] => {
  const pathIndexById = new Map(path.map((step, index) => [step.id, index]));

  const scheduledItems = schedule
    .flatMap((item) => {
      const pathIndex = pathIndexById.get(item.at);
      return pathIndex === undefined ? [] : [{ item, pathIndex }];
    })
    .sort((a, b) => a.pathIndex - b.pathIndex);

  let lastOffset = Duration.zero;
  const adjustments = new Map<string, string>();

  for (const { item, pathIndex } of scheduledItems) {
    const stop = item.stop_for ? Duration.parse(item.stop_for) : Duration.zero;
    if (!item.arrival) {
      lastOffset = lastOffset.add(stop);
      continue;
    }
    const arrival = Duration.parse(item.arrival);

    // Points before fromPathIndex are only used to find the lastOffset to use.
    if (pathIndex < fromPathIndex) {
      lastOffset = arrival.add(stop);
      continue;
    }

    const shifted = shift(arrival);
    const daysShift = Math.ceil((lastOffset.ms - shifted.ms) / ONE_DAY.ms);
    const adjusted = shifted.add(new Duration({ days: daysShift }));
    adjustments.set(item.at, adjusted.toISOString());
    lastOffset = adjusted.add(stop);
  }

  return schedule.map((item) =>
    adjustments.has(item.at) ? { ...item, arrival: adjustments.get(item.at) } : item
  );
};
