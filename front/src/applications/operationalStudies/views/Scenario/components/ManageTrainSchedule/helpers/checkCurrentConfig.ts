import type { OperationalStudiesConfState } from 'reducers/osrdconf/types';
import { isInvalidFloatNumber } from 'utils/numbers';

import { MAX_TIMEWINDOW_MINUTES } from '../consts';

export type TrainScheduleConfErrorCode =
  | 'noOrigin'
  | 'noDepartureTime'
  | 'noDestination'
  | 'noRollingStock'
  | 'noName'
  | 'invalidInitialSpeed'
  | 'intervalTooLow'
  | 'timeWindowTooLow'
  | 'timeWindowTooHigh';

const checkCurrentConfig = (
  osrdconf: OperationalStudiesConfState
): TrainScheduleConfErrorCode[] => {
  const {
    pathSteps,
    name: trainName,
    initialSpeed,
    startTime,
    interval,
    timeWindow,
    editingTrainType: editingItemType,
  } = osrdconf;
  const errors: TrainScheduleConfErrorCode[] = [];

  if (pathSteps[0] === null) {
    errors.push('noOrigin');
  }
  if (!startTime) {
    errors.push('noDepartureTime');
  }
  if (pathSteps[pathSteps.length - 1] === null) {
    errors.push('noDestination');
  }
  if (!trainName) {
    errors.push('noName');
  }
  if (isInvalidFloatNumber(initialSpeed!, 1)) {
    errors.push('invalidInitialSpeed');
  }

  // Only check interval and timeWindow for paced trains
  if (editingItemType === 'pacedTrain') {
    if (interval.total('minute') < 1) {
      errors.push('intervalTooLow');
    }
    if (timeWindow.total('minute') < 1) {
      errors.push('timeWindowTooLow');
    }
    if (timeWindow.total('minute') >= MAX_TIMEWINDOW_MINUTES) {
      errors.push('timeWindowTooHigh');
    }
  }

  return errors;
};

export default checkCurrentConfig;
