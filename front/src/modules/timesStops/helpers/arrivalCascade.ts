import type { PathItem, ScheduleItem } from 'common/api/osrdEditoastApi';
import { Duration } from 'utils/duration';

import { ONE_DAY } from '../consts';

/**
 * Shift the scheduled arrivals from fromPathIndex on.
 * Cascade midnight crossings for any arrival that ends up before the previous one.
 */
export const cascadeArrivals = ({
  schedule,
  path,
  fromPathIndex,
  baseline,
  shift = (arrival: Duration) => arrival,
}: {
  schedule: ScheduleItem[];
  path: PathItem[];
  fromPathIndex: number;
  baseline: Duration;
  shift?: (arrival: Duration) => Duration;
}): ScheduleItem[] => {
  const pathIndexById = new Map(path.map((step, index) => [step.id, index]));

  const affectedItems = schedule
    .map((item) => ({ item, pathIndex: pathIndexById.get(item.at) ?? -1 }))
    .filter(({ item, pathIndex }) => !!item.arrival && pathIndex >= fromPathIndex)
    .sort((a, b) => a.pathIndex - b.pathIndex);

  let lastOffset = baseline;
  const adjustments = new Map<string, string>();

  for (const { item } of affectedItems) {
    const shifted = shift(Duration.parse(item.arrival!));
    const adjusted = shifted.ms < lastOffset.ms ? shifted.add(ONE_DAY) : shifted;
    adjustments.set(item.at, adjusted.toISOString());
    lastOffset = adjusted;
  }

  return schedule.map((item) =>
    adjustments.has(item.at) ? { ...item, arrival: adjustments.get(item.at) } : item
  );
};
