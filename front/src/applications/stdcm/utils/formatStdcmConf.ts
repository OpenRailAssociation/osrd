import type { TFunction } from 'i18next';
import { compact } from 'lodash';
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
import { dateTimeFormatting } from 'utils/date';
import { kmhToMs, mToMm, tToKg } from 'utils/physics';
import { ISO8601Duration2sec, sec2ms } from 'utils/timeManipulation';

import createMargin from './createMargin';

const getStepLocation = (step: StdcmPathStep): PathItemLocation => {
  if ('track' in step) {
    return { track: step.track, offset: mToMm(step.offset) };
  }
  if ('operational_point' in step) {
    return { operational_point: step.operational_point };
  }
  if ('trigram' in step) {
    return { trigram: step.trigram, secondary_code: step.secondary_code };
  }
  if (step.uic === -1) {
    throw new Error('Invalid UIC');
  }
  return { uic: step.uic, secondary_code: step.secondary_code };
};

// TODO: DROP STDCM V1: remove formattedStartTime, startTime and latestStartTime
type ValidStdcmConfig = {
  rollingStockId: number;
  timetableId: number;
  infraId: number;
  rollingStockComfort: TrainScheduleBase['comfort'];
  path: PathfindingItem[];
  speedLimitByTag?: string;
  totalMass?: number;
  totalLength?: number;
  maxSpeed?: number;
  margin?: StandardAllowance;
  gridMarginBefore?: number;
  gridMarginAfter?: number;
  workScheduleGroupId?: number;
  electricalProfileSetId?: number;
};

export const checkStdcmConf = (
  dispatch: Dispatch,
  t: TFunction,
  osrdconf: OsrdStdcmConfState & InfraState
): ValidStdcmConfig | null => {
  const {
    stdcmPathSteps: pathSteps,
    timetableID,
    speedLimitByTag,
    rollingStockComfort,
    infraID,
    rollingStockID,
    standardStdcmAllowance,
    gridMarginBefore,
    gridMarginAfter,
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

  const origin = pathSteps.at(0);
  const destination = pathSteps.at(-1);

  const originArrival = origin?.arrival;
  const destinationArrival = destination?.arrival;
  const isDepartureScheduled = origin?.arrivalType === 'preciseTime';

  const startDateTime = isDepartureScheduled
    ? new Date(originArrival!)
    : new Date(destinationArrival!);

  if (
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
    const { arrival, tolerances, stopFor, arrivalType } = step;
    const location = getStepLocation(step);

    const duration = stopFor ? sec2ms(ISO8601Duration2sec(stopFor) || Number(stopFor)) : 0;
    const timingData =
      arrivalType === 'preciseTime' && arrival
        ? {
            arrival_time: arrival,
            arrival_time_tolerance_before: sec2ms(tolerances?.before ?? 0),
            arrival_time_tolerance_after: sec2ms(tolerances?.after ?? 0),
          }
        : undefined;
    return {
      duration,
      location,
      timing_data: timingData,
    };
  });

  return {
    infraId: infraID!,
    rollingStockId: rollingStockID!,
    timetableId: timetableID!,
    rollingStockComfort,
    path,
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
  validConfig: ValidStdcmConfig
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
    steps: validConfig.path,
    time_gap_after: toMsOrUndefined(validConfig.gridMarginBefore),
    time_gap_before: toMsOrUndefined(validConfig.gridMarginAfter),
    work_schedule_group_id: validConfig.workScheduleGroupId,
    electrical_profile_set_id: validConfig.electricalProfileSetId,
  },
});
