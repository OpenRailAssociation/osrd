import { compact } from 'lodash';
import type { Dispatch } from 'redux';

import getStepLocation from 'modules/pathfinding/helpers/getStepLocation';
import type { ValidConfig } from 'modules/trainschedule/components/ManageTrainSchedule/types';
import { setFailure } from 'reducers/main';
import type { OperationalStudiesConfState } from 'reducers/osrdconf/types';
import { isInvalidFloatNumber } from 'utils/numbers';
import { kmhToMs } from 'utils/physics';

import formatMargin from './formatMargin';
import formatSchedule from './formatSchedule';

const checkCurrentConfig = (
  osrdconf: OperationalStudiesConfState,
  t: (arg0: string) => string,
  dispatch: Dispatch,
  // TODO TS2 : remove this when rollingStockName will replace rollingStockId in the store
  rollingStockName?: string,
  ignoreTrainAddSettings = false
): ValidConfig | null => {
  const {
    constraintDistribution,
    pathSteps,
    name: trainName,
    timetableID,
    trainCount,
    trainDelta,
    trainStep,
    labels,
    speedLimitByTag,
    initialSpeed,
    usingElectricalProfiles,
    usingSpeedLimits,
    rollingStockComfort,
    powerRestriction,
    startTime,
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

  // TrainAddSettings tests
  if (!ignoreTrainAddSettings) {
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

  if (error) return null;
  return {
    constraintDistribution,
    rollingStockName: rollingStockName!,
    baseTrainName: trainName,
    timetableId: timetableID!,
    trainCount,
    trainStep,
    trainDelta,
    labels,
    rollingStockComfort,
    initialSpeed: initialSpeed ? kmhToMs(initialSpeed) : 0,
    usingElectricalProfiles,
    usingSpeedLimits,
    path: compact(pathSteps).map((step) => ({ id: step.id, ...getStepLocation(step) })),
    margins: formatMargin(compact(pathSteps)),
    schedule: formatSchedule(compact(pathSteps)),
    powerRestrictions: powerRestriction,
    firstStartTime: startTime.toISOString(),
    speedLimitByTag,
  };
};

export default checkCurrentConfig;
