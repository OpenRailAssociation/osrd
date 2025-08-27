import type { TFunction } from 'i18next';
import type { Dispatch } from 'redux';

import { setFailure } from 'reducers/main';
import type { OperationalStudiesConfState } from 'reducers/osrdconf/types';
import { isInvalidFloatNumber } from 'utils/numbers';

import { MAX_TIMEWINDOW_MINUTES } from '../consts';

const checkCurrentConfig = (
  osrdconf: OperationalStudiesConfState,
  t: TFunction<'operational-studies', 'manageTimetableItem'>,
  dispatch: Dispatch,
  // TODO TS2 : remove this when rollingStockName will replace rollingStockId in the store
  rollingStockName?: string
): boolean => {
  const {
    pathSteps,
    name: trainName,
    initialSpeed,
    startTime,
    interval,
    timeWindow,
    editingItemType,
  } = osrdconf;
  let error = false;
  if (pathSteps[0] === null) {
    error = true;
    dispatch(
      setFailure({
        name: t('errorMessages.timetableItemTitle'),
        message: t('errorMessages.noOrigin'),
      })
    );
  }
  if (!startTime) {
    error = true;
    dispatch(
      setFailure({
        name: t('errorMessages.timetableItemTitle'),
        message: t('errorMessages.noDepartureTime'),
      })
    );
  }
  if (pathSteps[pathSteps.length - 1] === null) {
    error = true;
    dispatch(
      setFailure({
        name: t('errorMessages.timetableItemTitle'),
        message: t('errorMessages.noDestination'),
      })
    );
  }
  if (!rollingStockName) {
    error = true;
    dispatch(
      setFailure({
        name: t('errorMessages.timetableItemTitle'),
        message: t('errorMessages.noRollingStock'),
      })
    );
  }
  if (!trainName) {
    error = true;
    dispatch(
      setFailure({
        name: t('errorMessages.timetableItemTitle'),
        message: t('errorMessages.noName'),
      })
    );
  }

  if (isInvalidFloatNumber(initialSpeed!, 1)) {
    error = true;
    dispatch(
      setFailure({
        name: t('errorMessages.timetableItemTitle'),
        message: t('errorMessages.invalidInitialSpeed'),
      })
    );
  }

  // Prevent to block the train creation if a paced train field is invalid but we want to add a train schedule
  if (editingItemType === 'pacedTrain') {
    if (interval.total('minute') < 1) {
      error = true;
      dispatch(
        setFailure({
          name: t('errorMessages.timetableItemTitle'),
          message: t('errorMessages.tooLowValue', {
            value: t('pacedTrains.interval').toLowerCase(),
          }),
        })
      );
    }
    if (timeWindow.total('minute') < 1) {
      error = true;
      dispatch(
        setFailure({
          name: t('errorMessages.timetableItemTitle'),
          message: t('errorMessages.tooLowValue', {
            value: t('pacedTrains.timeWindow').toLowerCase(),
          }),
        })
      );
    }
    if (timeWindow.total('minute') >= MAX_TIMEWINDOW_MINUTES) {
      error = true;
      dispatch(
        setFailure({
          name: t('errorMessages.timetableItemTitle'),
          message: t('errorMessages.tooHighValue', {
            value: t('pacedTrains.timeWindow').toLowerCase(),
          }),
        })
      );
    }
  }

  return !error;
};

export default checkCurrentConfig;
