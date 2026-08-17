import type { TrainSchedule } from 'common/api/osrdEditoastApi';
import { Duration } from 'utils/duration';
import { isInvalidFloatNumber } from 'utils/numbers';
import { msToKmh } from 'utils/physics';

import { MAX_TIMEWINDOW_MINUTES } from '../consts';

export type TrainScheduleConfErrorCode =
  | 'noOrigin'
  | 'noDepartureTime'
  | 'noDestination'
  | 'noRollingStock'
  | 'noName'
  | 'invalidInitialSpeed'
  | 'pacedTrainInterval.tooLow'
  | 'pacedTrainTimeWindow.tooLow'
  | 'pacedTrainTimeWindow.tooHigh';

export function validateTrainSchedule(train: TrainSchedule): TrainScheduleConfErrorCode[] {
  const errors: TrainScheduleConfErrorCode[] = [];

  if (train.path[0] === null) {
    errors.push('noOrigin');
  }
  if (!train.start_time) {
    errors.push('noDepartureTime');
  }
  if (train.path.at(-1) === null) {
    errors.push('noDestination');
  }
  if (!train.train_name) {
    errors.push('noName');
  }
  if (isInvalidFloatNumber(msToKmh(train.initial_speed!), 1)) {
    errors.push('invalidInitialSpeed');
  }

  // Only check interval and timeWindow for paced trains
  if (train.paced) {
    const intervalDuration = Duration.parse(train.paced.interval);
    const timeWindowDuration = Duration.parse(train.paced.time_window);

    if (intervalDuration.total('minute') < 1) {
      errors.push('pacedTrainInterval.tooLow');
    }
    if (timeWindowDuration.total('minute') < 1) {
      errors.push('pacedTrainTimeWindow.tooLow');
    }
    if (timeWindowDuration.total('minute') >= MAX_TIMEWINDOW_MINUTES) {
      errors.push('pacedTrainTimeWindow.tooHigh');
    }
  }

  return errors;
}
