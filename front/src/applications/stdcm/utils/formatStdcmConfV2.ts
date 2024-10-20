/* eslint-disable @typescript-eslint/no-unused-vars */
import type { TFunction } from 'i18next';
import { compact, last } from 'lodash';
import type { Dispatch } from 'redux';

import type {
  PathfindingItem,
  PostTimetableByIdStdcmApiArg,
  TrainScheduleBase,
} from 'common/api/osrdEditoastApi';
import type { InfraState } from 'reducers/infra';
import { setFailure } from 'reducers/main';
import type { OsrdStdcmConfState, StandardAllowance } from 'reducers/osrdconf/types';
import { dateTimeFormatting, dateTimeToIso } from 'utils/date';
import { kmhToMs, mToMm, tToKg } from 'utils/physics';
import { ISO8601Duration2sec, sec2ms, time2sec } from 'utils/timeManipulation';

import createMargin from './createMargin';

// TODO: DROP STDCM V1: remove formattedStartTime, startTime and latestStartTime
type ValidStdcmConfig = {
  formattedStartTime?: string;
  rollingStockId: number;
  timetableId: number;
  infraId: number;
  rollingStockComfort: TrainScheduleBase['comfort'];
  path: PathfindingItem[];
  speedLimitByTag?: string;
  totalMass?: number;
  totalLength?: number;
  maxSpeed?: number;
  maximumRunTime?: number;
  startTime?: string; // must be a datetime
  latestStartTime?: string;
  margin?: StandardAllowance;
  gridMarginBefore?: number;
  gridMarginAfter?: number;
  workScheduleGroupId?: number;
  electricalProfileSetId?: number;
};

export const checkStdcmConf = (
  dispatch: Dispatch,
  t: TFunction,
  osrdconf: OsrdStdcmConfState & InfraState,
  // TODO: Remove this parameter when we drop V1
  stdcmV2Activated = true,
  isDebugMode = false
): ValidStdcmConfig | null => {
  const {
    pathSteps,
    timetableID,
    speedLimitByTag,
    rollingStockComfort,
    infraID,
    rollingStockID,
    maximumRunTime,
    standardStdcmAllowance,
    gridMarginBefore,
    gridMarginAfter,
    originUpperBoundTime,
    originDate,
    originTime,
    searchDatetimeWindow,
    workScheduleGroupId,
    electricalProfileSetId,
    totalLength,
    totalMass,
    maxSpeed,
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
  // TODO: remove this condition when we drop V1
  if (!(osrdconf.originTime && osrdconf.originUpperBoundTime) && !stdcmV2Activated) {
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

  let startDateTime: Date | null;

  if (stdcmV2Activated) {
    // If stdcmV2Activated is true, we use the arrival date from either the origin or the destination
    const firstArrival = pathSteps[0]?.arrival;
    const lastArrival = last(pathSteps)?.arrival;
    const isDepartureScheduled = pathSteps[0]?.arrivalType === 'preciseTime';

    startDateTime = isDepartureScheduled ? new Date(firstArrival!) : new Date(lastArrival!);
  } else if (!startTime) {
    error = true;
    dispatch(
      setFailure({
        name: t('operationalStudies/manageTrainSchedule:errorMessages.trainScheduleTitle'),
        message: t('operationalStudies/manageTrainSchedule:errorMessages.noOriginTime'),
      })
    );
    startDateTime = null;
  } else {
    startDateTime = new Date(startTime);
  }

  if (
    !isDebugMode &&
    searchDatetimeWindow &&
    startDateTime &&
    (startDateTime < searchDatetimeWindow.begin || searchDatetimeWindow.end < startDateTime)
  ) {
    error = true;
    dispatch(
      setFailure({
        name: t('operationalStudies/manageTrainSchedule:errorMessages.trainScheduleTitle'),
        message: t('operationalStudies/manageTrainSchedule:errorMessages.originTimeOutsideWindow', {
          low: dateTimeFormatting(searchDatetimeWindow.begin, false, false),
          high: dateTimeFormatting(searchDatetimeWindow.end, false, false),
        }),
      })
    );
  }

  if (error) return null;

  const path = compact(osrdconf.pathSteps).map((step) => {
    const {
      id,
      arrival,
      arrivalType,
      arrivalToleranceBefore,
      arrivalToleranceAfter,
      deleted,
      locked,
      stopFor,
      stopType,
      positionOnPath,
      coordinates,
      name,
      ch,
      metadata,
      theoreticalMargin,
      kp,
      receptionSignal,
      ...stepLocation
    } = step;

    const duration = stopFor ? sec2ms(ISO8601Duration2sec(stopFor) || Number(stopFor)) : 0;
    const timingData =
      arrivalType === 'preciseTime' && arrival
        ? {
            arrival_time: arrival,
            arrival_time_tolerance_before: sec2ms(arrivalToleranceBefore ?? 0),
            arrival_time_tolerance_after: sec2ms(arrivalToleranceAfter ?? 0),
          }
        : undefined;

    if ('track' in stepLocation) {
      return {
        duration,
        location: { track: stepLocation.track, offset: mToMm(stepLocation.offset) },
        timing_data: timingData,
      };
    }

    const secondary_code = 'trigram' in stepLocation || 'uic' in stepLocation ? ch : undefined;
    return {
      duration,
      location: { ...stepLocation, secondary_code },
      timing_data: timingData,
    };
  });

  return {
    infraId: infraID!,
    rollingStockId: rollingStockID!,
    timetableId: timetableID!,
    rollingStockComfort,
    path,
    ...(!stdcmV2Activated && {
      startTime: originTime!,
      formattedStartTime: startTime!,
      latestStartTime: originUpperBoundTime!,
      maximumRunTime,
    }),
    speedLimitByTag,
    totalMass,
    totalLength,
    maxSpeed,
    margin: standardStdcmAllowance,
    gridMarginBefore,
    gridMarginAfter,
    workScheduleGroupId,
    electricalProfileSetId,
  };
};

const toMsOrUndefined = (value: number | undefined): number | undefined =>
  value ? sec2ms(value) : undefined;

export const formatStdcmPayload = (
  validConfig: ValidStdcmConfig,
  stdcmV2Activated: boolean
): PostTimetableByIdStdcmApiArg => ({
  infra: validConfig.infraId,
  id: validConfig.timetableId,
  body: {
    comfort: validConfig.rollingStockComfort || 'STANDARD',
    margin: createMargin(validConfig.margin),
    rolling_stock_id: validConfig.rollingStockId,
    speed_limit_tags: validConfig.speedLimitByTag,
    total_mass: validConfig.totalMass ? tToKg(validConfig.totalMass) : undefined,
    max_speed: validConfig.maxSpeed ? kmhToMs(validConfig.maxSpeed) : undefined,
    total_length: validConfig.totalLength,
    ...(!stdcmV2Activated && {
      maximum_run_time: toMsOrUndefined(validConfig.maximumRunTime),
      maximum_departure_delay: sec2ms(
        time2sec(validConfig.latestStartTime!) - time2sec(validConfig.startTime!)
      ),
      start_time: validConfig.formattedStartTime,
    }),
    steps: validConfig.path,
    time_gap_after: toMsOrUndefined(validConfig.gridMarginBefore),
    time_gap_before: toMsOrUndefined(validConfig.gridMarginAfter),
    work_schedule_group_id: validConfig.workScheduleGroupId,
    electrical_profile_set_id: validConfig.electricalProfileSetId,
  },
});
