import type { TrainScheduleFromJson } from 'applications/operationalStudies/types';
import { Duration } from 'utils/duration';

const startTimeToMs = (startTime: string | number): number =>
  typeof startTime === 'string' ? new Date(startTime).getTime() : startTime;

/**
 * Fold a start time into an interval, so it becomes an offset the database accepts.
 *
 * The database enforces `0 <= start_time < interval <= time_window` on hourly train
 * schedule sets. The double modulo brings negative values back into range
 */
const foldOffset = (startTimeMs: number, interval: Duration): number =>
  interval.ms > 0 ? ((startTimeMs % interval.ms) + interval.ms) % interval.ms : startTimeMs;

/**
 * Transform a train schedule from an imported xml file into a train schedule
 * The start time is folded into an offset
 * Xml file with unique trains is transformed into a paced train schedule.
 * Paced trains are transformed into a paced train schedule with the same interval and the pattern duration as time window.
 */
export const toHourlyPattern = (
  train: TrainScheduleFromJson,
  patternDuration: Duration
): TrainScheduleFromJson => {
  const fileInterval = train.paced ? Duration.parse(train.paced.interval) : patternDuration;
  // The database also requires interval <= time_window, and a file may pace a train more
  // slowly than the pattern it is imported into
  const interval = fileInterval.ms <= patternDuration.ms ? fileInterval : patternDuration;

  return {
    ...train,
    start_time: foldOffset(startTimeToMs(train.start_time), interval),
    paced: {
      interval: interval.toISOString(),
      time_window: patternDuration.toISOString(),
      exceptions: [],
    },
  };
};
