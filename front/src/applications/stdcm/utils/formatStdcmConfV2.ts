import type { TFunction } from 'i18next';
import { compact, last } from 'lodash';
import type { Dispatch } from 'redux';

import type {
  PathItemLocation,
  PathfindingItem,
  PostTimetableByIdStdcmApiArg,
  TrainScheduleBase,
} from 'common/api/osrdEditoastApi';
import type { InfraState } from 'reducers/infra';
import { setFailure } from 'reducers/main';
import type { OsrdStdcmConfState, StandardAllowance, StdcmPathStep } from 'reducers/osrdconf/types';
import { dateTimeFormatting, dateTimeToIso } from 'utils/date';
import { mToMm } from 'utils/physics';
import { ISO8601Duration2sec, sec2ms, time2sec } from 'utils/timeManipulation';

import createMargin from './createMargin';

const getStepLocation = (step: StdcmPathStep): PathItemLocation | undefined => {
  if (!step.location) return undefined;
  const { location } = step;
  if ('track' in location) {
    return { track: location.track, offset: mToMm(location.offset) };
  }
  if ('operational_point' in location) {
    return { operational_point: location.operational_point };
  }
  if ('trigram' in location) {
    return { trigram: location.trigram, secondary_code: location.secondary_code };
  }
  return { uic: location.uic, secondary_code: location.secondary_code };
};

// TODO: DROP STDCM V1: remove formattedStartTime, startTime and latestStartTime
type ValidStdcmConfig = {
  formattedStartTime?: string;
  rollingStockId: number;
  timetableId: number;
  infraId: number;
  rollingStockComfort: TrainScheduleBase['comfort'];
  path: PathfindingItem[];
  speedLimitByTag?: string;
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
    stdcmPathSteps,
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
  } = osrdconf;
  let error = false;
  if (!stdcmPathSteps[0].location) {
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
  if (!stdcmPathSteps[stdcmPathSteps.length - 1].location) {
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

  let startDateTime: Date;

  if (stdcmV2Activated) {
    // If stdcmV2Activated is true, we use the arrival date from either the origin or the destination
    const origin = stdcmPathSteps[0];
    if (origin.isVia) {
      throw new Error('The origin cannot be a via point');
    }

    const firstArrival = origin.arrival;
    const lastArrival = last(stdcmPathSteps)?.arrival;
    const isDepartureScheduled = origin.arrivalType === 'preciseTime';

    startDateTime = isDepartureScheduled ? new Date(firstArrival!) : new Date(lastArrival!);
  } else if (!startTime) {
    error = true;
    dispatch(
      setFailure({
        name: t('operationalStudies/manageTrainSchedule:errorMessages.trainScheduleTitle'),
        message: t('operationalStudies/manageTrainSchedule:errorMessages.noOriginTime'),
      })
    );
    return null;
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

  const path = compact(osrdconf.stdcmPathSteps).map((step) => {
    const stepLocation = getStepLocation(step);
    if (!stepLocation) {
      throw new Error('Missing location');
    }

    const { stopFor } = step;
    const duration = stopFor ? sec2ms(ISO8601Duration2sec(stopFor) || Number(stopFor)) : 0;

    let timingData;
    if (step.arrival) {
      const { arrival } = step;
      if (step.isVia) {
        timingData = {
          arrival_time: arrival.toISOString(),
          arrival_time_tolerance_before: sec2ms(step.arrivalToleranceBefore ?? 0),
          arrival_time_tolerance_after: sec2ms(step.arrivalToleranceAfter ?? 0),
        };
      } else {
        if (step.arrivalType === 'preciseTime') {
          timingData = {
            arrival_time: arrival.toISOString(),
            arrival_time_tolerance_before: 0,
            arrival_time_tolerance_after: 0,
          };
        }
      }
    }

    if ('track' in stepLocation) {
      return {
        duration,
        location: { track: stepLocation.track, offset: mToMm(stepLocation.offset) },
        timing_data: timingData,
      };
    }

    return {
      duration,
      location: { ...stepLocation },
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
