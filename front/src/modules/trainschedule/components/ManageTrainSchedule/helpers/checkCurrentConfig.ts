/* eslint-disable @typescript-eslint/no-unused-vars */
import { compact } from 'lodash';
import type { Dispatch } from 'redux';

import type { ValidConfig } from 'modules/trainschedule/components/ManageTrainSchedule/types';
import { setFailure } from 'reducers/main';
import type { OsrdConfState } from 'reducers/osrdconf/types';
import { kmhToMs } from 'utils/physics';

import formatMargin from './formatMargin';
import formatSchedule from './formatSchedule';

const checkCurrentConfig = (
  osrdconf: OsrdConfState,
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
    rollingStockComfortV2,
    powerRestrictionV2,
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
    rollingStockName: rollingStockName as string,
    baseTrainName: trainName,
    timetableId: timetableID as number,
    trainCount,
    trainStep,
    trainDelta,
    labels,
    rollingStockComfort: rollingStockComfortV2,
    initialSpeed: initialSpeed ? kmhToMs(initialSpeed) : 0,
    usingElectricalProfiles,
    path: compact(osrdconf.pathSteps).map((step) => {
      const {
        arrival,
        locked,
        stopFor,
        positionOnPath,
        coordinates,
        name,
        ch,
        metadata,
        kp,
        onStopSignal,
        theoreticalMargin,
        ...path
      } = step;
      return { ...path, secondary_code: ch };
    }),

    margins: formatMargin(compact(pathSteps)),
    schedule: formatSchedule(compact(pathSteps), startTime),
    powerRestrictions: powerRestrictionV2,
    firstStartTime: startTime,
    speedLimitByTag,
  };
};

export default checkCurrentConfig;
