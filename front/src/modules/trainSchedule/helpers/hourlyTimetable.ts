import { isNumber } from 'lodash';

import type { PacedTrainException, TrainScheduleResponse } from 'common/api/osrdEditoastApi';
import { Duration } from 'utils/duration';
import { lcm } from 'utils/numbers';

import { getOccurrencesNb, isPacedTrain } from './pacedTrain';

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

/** Wrap `value` into `[0, period)`, also for negative values. */
const wrap = (value: number, period: number) => ((value % period) + period) % period;

/**
 * Wrap a time offset of an hourly timetable into `[0, period)`, so that a time dragged before the
 * timetable start or after its end comes back in from the other side (-00:05 → 01:55 for 2h).
 */
export const wrapHourlyTime = (ms: number, period: Duration): number => wrap(ms, period.ms);

export function wrapHourlyPacedTrainStartTime(
  startTimeMs: number,
  paced: Pick<NonNullable<TrainScheduleResponse['paced']>, 'interval' | 'time_window'>,
  exceptions: PacedTrainException[]
): { startTimeMs: number; exceptions: PacedTrainException[] } {
  const interval = Duration.parse(paced.interval);
  const timeWindow = Duration.parse(paced.time_window);
  const occurrencesCount = getOccurrencesNb({ interval, timeWindow });
  const shift = Math.floor(startTimeMs / interval.ms);

  return {
    startTimeMs: startTimeMs - shift * interval.ms,
    exceptions: exceptions.map((exception) => ({
      ...exception,
      ...(isNumber(exception.occurrence_index) && {
        occurrence_index: wrap(exception.occurrence_index + shift, occurrencesCount),
      }),
      ...(exception.start_time && {
        start_time: { value: wrapHourlyTime(exception.start_time.value, timeWindow) },
      }),
    })),
  };
}
