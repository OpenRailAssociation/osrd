import type { PacedTrainException, TrainScheduleResponse } from 'common/api/osrdEditoastApi';
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
 * Wrap a start time of an hourly timetable into `[0, period)`.
 *
 * Hourly start times are offsets from the timetable start, and everything repeats on the
 * diagram, so wrapping by the relevant period keeps a value inside the pattern without moving
 * anything on screen. The period to wrap by depends on what the start time belongs to:
 *
 * - the model of a paced train repeats every `interval`, and the backend rejects anything
 *   outside `0 <= start_time < interval` with a 500;
 * - an occurrence repeats every `time_window`, so a start time exception belongs to that range.
 */
export function wrapHourlyStartTime(startTimeMs: number, period: Duration): number {
  return ((startTimeMs % period.ms) + period.ms) % period.ms;
}

/**
 * Wrap the start time of every exception of a paced train into `[0, timeWindow)`, so that
 * shifting a whole paced train never leaves an occurrence outside the hourly pattern.
 * Exceptions without a start time change are returned untouched.
 */
export function wrapHourlyExceptionStartTimes(
  exceptions: PacedTrainException[],
  timeWindow: Duration
): PacedTrainException[] {
  return exceptions.map((exception) =>
    exception.start_time
      ? {
          ...exception,
          start_time: { value: wrapHourlyStartTime(exception.start_time.value, timeWindow) },
        }
      : exception
  );
}
