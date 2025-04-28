import type { TFunction } from 'i18next';
import type { Dispatch } from 'redux';

import { setFailure } from 'reducers/main';
import type { OperationalStudiesConfState } from 'reducers/osrdconf/types';
import { isInvalidFloatNumber } from 'utils/numbers';

const checkCurrentConfig = (
  osrdconf: OperationalStudiesConfState,
  t: TFunction,
  dispatch: Dispatch,
  // TODO TS2 : remove this when rollingStockName will replace rollingStockId in the store
  rollingStockName?: string,
  { showPacedTrains = false }: { showPacedTrains?: boolean } = {}
): boolean => {
  const {
    pathSteps,
    name: trainName,
    timetableID,
    trainCount,
    trainDelta,
    trainStep,
    initialSpeed,
    startTime,
    interval,
    timeWindow,
    editingTrainIsPacedTrain,
  } = osrdconf;
  let error = false;
  if (pathSteps[0] === null) {
    error = true;
    dispatch(
      setFailure({
        name: t('errorMessages.trainScheduleTitle'),
        message: t('errorMessages.noOrigin'),
      })
    );
  }
  if (!startTime) {
    error = true;
    dispatch(
      setFailure({
        name: t('errorMessages.trainScheduleTitle'),
        message: t('errorMessages.noDepartureTime'),
      })
    );
  }
  if (pathSteps[pathSteps.length - 1] === null) {
    error = true;
    dispatch(
      setFailure({
        name: t('errorMessages.trainScheduleTitle'),
        message: t('errorMessages.noDestination'),
      })
    );
  }
  if (!rollingStockName) {
    error = true;
    dispatch(
      setFailure({
        name: t('errorMessages.trainScheduleTitle'),
        message: t('errorMessages.noRollingStock'),
      })
    );
  }
  if (!trainName) {
    error = true;
    dispatch(
      setFailure({
        name: t('errorMessages.trainScheduleTitle'),
        message: t('errorMessages.noName'),
      })
    );
  }
  if (!timetableID) {
    error = true;
    dispatch(
      setFailure({
        name: t('errorMessages.trainScheduleTitle'),
        message: t('errorMessages.noTimetable'),
      })
    );
  }

  if (isInvalidFloatNumber(initialSpeed!, 1)) {
    error = true;
    dispatch(
      setFailure({
        name: t('errorMessages.trainScheduleTitle'),
        message: t('errorMessages.invalidInitialSpeed'),
      })
    );
  }

  // TODO Paced trains : remove this in https://github.com/OpenRailAssociation/osrd/issues/10791
  if (!showPacedTrains) {
    if (trainCount < 1) {
      error = true;
      dispatch(
        setFailure({
          name: t('errorMessages.trainScheduleTitle'),
          message: t('errorMessages.noTrainCount'),
        })
      );
    }
    if (trainDelta < 1) {
      error = true;
      dispatch(
        setFailure({
          name: t('errorMessages.trainScheduleTitle'),
          message: t('errorMessages.noDelta'),
        })
      );
    }
    if (trainStep < 1) {
      error = true;
      dispatch(
        setFailure({
          name: t('errorMessages.trainScheduleTitle'),
          message: t('errorMessages.noTrainStep'),
        })
      );
    }
  }

  // TODO Paced trains : remove the next if in https://github.com/OpenRailAssociation/osrd/issues/10791
  if (showPacedTrains) {
    // Prevent to block the train creation if a paced train field is invalid but we want to add a train schedule
    if (editingTrainIsPacedTrain) {
      if (interval.total('minute') < 1) {
        error = true;
        dispatch(
          setFailure({
            name: t('errorMessages.trainScheduleTitle'),
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
            name: t('errorMessages.trainScheduleTitle'),
            message: t('errorMessages.tooLowValue', {
              value: t('pacedTrains.timeWindow').toLowerCase(),
            }),
          })
        );
      }
    }
  }

  return !error;
};

export default checkCurrentConfig;
