import type { TrainScheduleResponse } from 'common/api/osrdEditoastApi';
import { Duration } from 'utils/duration';
import { lcm } from 'utils/numbers';

import { isPacedTrain } from './pacedTrain';

/**
 * Default duration for an hourly timetable, used when it contains no paced trains.
 */
export const DEFAULT_HOURLY_TIMETABLE_DURATION = new Duration({ hours: 2 });

/**
 * Compute the hourly timetable duration from the paced trains it contains.
 *
 * The duration is the least common multiple (LCM) of the paced train durations (their
 * `time_window`): the minimal duration needed to have a repeating pattern. For example, a 2h
 * paced train and a 3h paced train give a 6h hourly timetable.
 *
 * When there is no paced train, the duration defaults to `DEFAULT_HOURLY_TIMETABLE_DURATION`.
 *
 */
export function computeHourlyTimetableDuration(trainSchedules: TrainScheduleResponse[]): Duration {
  const pacedTrainDurationsMs = trainSchedules
    .filter(isPacedTrain)
    .map((trainSchedule) => Duration.parse(trainSchedule.paced.time_window).ms);

  if (pacedTrainDurationsMs.length === 0) {
    return DEFAULT_HOURLY_TIMETABLE_DURATION;
  }

  return new Duration({
    milliseconds: pacedTrainDurationsMs.reduce((acc, ms) => lcm(acc, ms)),
  });
}

/**
 * Whether a start time is in `[0, period)`. In an hourly timetable, the period is the interval
 * for a paced train (`0 <= start_time < interval`) and the time window for an added occurrence
 * (`0 <= start_time < time_window`).
 */
export const isStartTimeWithinInterval = (startTime: Duration, period: Duration): boolean =>
  startTime.ms >= 0 && startTime.ms < period.ms;

/** Bring a start time back into `[0, period)` (see `isStartTimeWithinInterval`). */
export const wrapStartTimeToInterval = (startTime: Duration, period: Duration): Duration =>
  new Duration({ milliseconds: ((startTime.ms % period.ms) + period.ms) % period.ms });

/**
 * In an hourly timetable, the period a start time must stay in: the interval for a paced train,
 * and the time window for one of its added occurrences.
 */
export const getHourlyStartTimePeriod = (
  paced: { interval: string; time_window: string },
  isAddedOccurrence: boolean
): Duration => Duration.parse(isAddedOccurrence ? paced.time_window : paced.interval);
