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
