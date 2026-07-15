import type { TrainSpaceTimeData } from 'modules/simulationResult/types';
import { Duration } from 'utils/duration';

/**
 * A relative time range.
 *
 * end is an exclusive bound.
 */
export type TimeRange = {
  start: Duration;
  end: Duration;
};

/**
 * Compute a list of time offsets a train schedule needs to be repeated on to
 * fill a time range.
 *
 * This helper can be used to repeat a paced train related pattern within the
 * space time chart (curves, occupancy blocks, and so on) for hourly
 * timetables.
 *
 * The caller is expected to repeat the train schedule once per returned array
 * element, shifting the train schedule by the time offset each time.
 */
export default function getTrainScheduleRepeatOffsets(
  trainSchedule: Pick<TrainSpaceTimeData, 'paced'>,
  range: TimeRange
): Duration[] {
  if (!trainSchedule.paced) {
    return [Duration.zero];
  }

  const effectiveRangeStart = range.start; // TODO: take travel time into account

  const timeWindow = trainSchedule.paced.timeWindow;
  const repeatStartIndex = Math.floor(effectiveRangeStart.ms / timeWindow.ms);
  const repeatEndIndex = Math.ceil(range.end.ms / timeWindow.ms);

  const offsets: Duration[] = [];
  for (let i = repeatStartIndex; i < repeatEndIndex; i++) {
    offsets.push(new Duration({ milliseconds: i * timeWindow.ms }));
  }

  return offsets;
}
