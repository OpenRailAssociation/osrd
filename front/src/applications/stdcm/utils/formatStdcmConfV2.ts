/* eslint-disable @typescript-eslint/no-unused-vars */
import type { TFunction } from 'i18next';
import { compact } from 'lodash';
import type { Dispatch } from 'redux';

import type {
  PathfindingItem,
  PostV2TimetableByIdStdcmApiArg,
  TrainScheduleBase,
} from 'common/api/osrdEditoastApi';
import type { InfraState } from 'reducers/infra';
import { setFailure } from 'reducers/main';
import type { OsrdStdcmConfState, StandardAllowance } from 'reducers/osrdconf/types';
import { dateTimeToIso } from 'utils/date';
import { ISO8601Duration2sec, sec2ms, time2sec } from 'utils/timeManipulation';

import createMargin from './createMargin';

type ValidStdcmConfig = {
  formattedStartTime: string;
  rollingStockId: number;
  timetableId: number;
  infraId: number;
  rollingStockComfort: TrainScheduleBase['comfort'];
  path: PathfindingItem[];
  speedLimitByTag?: string;
  maximumRunTime: number;
  startTime: string; // must be a datetime
  lastestStartTime: string;
  margin?: StandardAllowance;
  gridMarginBefore?: number;
  gridMarginAfter?: number;
};

export const checkStdcmConf = (
  dispatch: Dispatch,
  t: TFunction,
  osrdconf: OsrdStdcmConfState & InfraState
): ValidStdcmConfig | null => {
  const {
    pathSteps,
    timetableID,
    speedLimitByTag,
    rollingStockComfortV2,
    infraID,
    rollingStockID,
    maximumRunTime,
    standardStdcmAllowance,
    gridMarginBefore,
    gridMarginAfter,
    originUpperBoundTime,
    originDate,
    originTime,
  } = osrdconf;
  let error = false;
  if (pathSteps[0] === null) {
    error = true;
    dispatch(
      setFailure({
        name: t('operationalStudies/manageTrainSchedule:errorMessages.trainScheduleTitle'),
        message: t('operationalStudies/manageTrainSchedule:errorMessages.noOrigin'),
      })
    );
  }
  if (!(osrdconf.originTime && osrdconf.originUpperBoundTime)) {
    error = true;
    dispatch(
      setFailure({
        name: t('operationalStudies/manageTrainSchedule:errorMessages.trainScheduleTitle'),
        message: t('operationalStudies/manageTrainSchedule:errorMessages.noOriginTime'),
      })
    );
  }
  if (pathSteps[pathSteps.length - 1] === null) {
    error = true;
    dispatch(
      setFailure({
        name: t('operationalStudies/manageTrainSchedule:errorMessages.trainScheduleTitle'),
        message: t('operationalStudies/manageTrainSchedule:errorMessages.noDestination'),
      })
    );
  }
  if (!rollingStockID) {
    error = true;
    dispatch(
      setFailure({
        name: t('operationalStudies/manageTrainSchedule:errorMessages.trainScheduleTitle'),
        message: t('operationalStudies/manageTrainSchedule:errorMessages.noRollingStock'),
      })
    );
  }
  if (!infraID) {
    error = true;
    dispatch(
      setFailure({
        name: t('operationalStudies/manageTrainSchedule:errorMessages.trainScheduleTitle'),
        message: t('operationalStudies/manageTrainSchedule:errorMessages.noName'),
      })
    );
  }
  if (!timetableID) {
    error = true;
    dispatch(
      setFailure({
        name: t('operationalStudies/manageTrainSchedule:errorMessages.trainScheduleTitle'),
        message: t('operationalStudies/manageTrainSchedule:errorMessages.noTimetable'),
      })
    );
  }
  const startTime = dateTimeToIso(`${originDate}T${originTime}`);
  if (!startTime) {
    error = true;
    dispatch(
      setFailure({
        name: t('operationalStudies/manageTrainSchedule:errorMessages.trainScheduleTitle'),
        message: t('operationalStudies/manageTrainSchedule:errorMessages.noOriginTime'),
      })
    );
  }

  if (error) return null;
  return {
    infraId: infraID!,
    rollingStockId: rollingStockID!,
    timetableId: timetableID!,
    rollingStockComfort: rollingStockComfortV2,
    path: compact(osrdconf.pathSteps).map((step, index) => {
      const {
        id,
        arrival,
        locked,
        stopFor,
        positionOnPath,
        coordinates,
        name,
        ch,
        metadata,
        theoreticalMargin,
        kp,
        onStopSignal,
        ...stepLocation
      } = step;

      const secondary_code = 'trigram' in stepLocation || 'uic' in stepLocation ? ch : undefined;
      let duration: number;
      if (index === osrdconf.pathSteps.length - 1) {
        duration = 1;
      } else {
        duration = sec2ms(ISO8601Duration2sec(stopFor || '')) || 0;
      }

      return {
        duration,
        location: { ...stepLocation, secondary_code },
      };
    }),
    startTime: originTime!,
    formattedStartTime: startTime!,
    speedLimitByTag,
    maximumRunTime,
    margin: standardStdcmAllowance,
    gridMarginBefore,
    gridMarginAfter,
    lastestStartTime: originUpperBoundTime!,
  };
};

const toMsOrUndefined = (value: number | undefined): number | undefined =>
  value ? sec2ms(value) : undefined;

export const formatStdcmPayload = (
  validConfig: ValidStdcmConfig
): PostV2TimetableByIdStdcmApiArg => {
  const maximumDepartureDelay = sec2ms(
    time2sec(validConfig.lastestStartTime) - time2sec(validConfig.startTime)
  );

  return {
    infra: validConfig.infraId,
    id: validConfig.timetableId,
    body: {
      comfort: validConfig.rollingStockComfort || 'STANDARD',
      margin: createMargin(validConfig.margin),
      maximum_departure_delay: maximumDepartureDelay,
      maximum_run_time: toMsOrUndefined(validConfig.maximumRunTime),
      rolling_stock_id: validConfig.rollingStockId,
      speed_limit_tags: validConfig.speedLimitByTag,
      start_time: validConfig.formattedStartTime,
      steps: validConfig.path,
      time_gap_after: toMsOrUndefined(validConfig.gridMarginBefore),
      time_gap_before: toMsOrUndefined(validConfig.gridMarginAfter),
    },
  };
};
