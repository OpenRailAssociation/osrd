import type { Conflict } from '@osrd-project/ui-charts';

import { Duration } from 'utils/duration';

import { getTimetableRepeatOffsets, type TimeRange } from './getTrainScheduleRepeatOffsets';

/**
 * Repeat conflicts across a visible time range for hourly timetables.
 */
export default function repeatConflictsInRange(
  conflicts: Conflict[],
  period: Duration,
  range: TimeRange
): Conflict[] {
  if (conflicts.length === 0 || period.ms <= 0) {
    return conflicts;
  }

  const maxDurationMs = Math.max(...conflicts.map((c) => c.timeEnd - c.timeStart));
  const repeatOffsets = getTimetableRepeatOffsets({
    period,
    maxItemDuration: new Duration({ milliseconds: maxDurationMs }),
    range,
  });

  const repeatedConflicts: Conflict[] = [];
  for (const offset of repeatOffsets) {
    for (const conflict of conflicts) {
      repeatedConflicts.push({
        ...conflict,
        timeStart: conflict.timeStart + offset.ms,
        timeEnd: conflict.timeEnd + offset.ms,
      });
    }
  }
  return repeatedConflicts;
}
