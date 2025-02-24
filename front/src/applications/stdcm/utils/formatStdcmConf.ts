import type { TFunction } from 'i18next';
import { compact } from 'lodash';
import type { Dispatch } from 'redux';

import type { PathfindingItem, PostTimetableByIdStdcmApiArg } from 'common/api/osrdEditoastApi';
import getStepLocation from 'modules/pathfinding/helpers/getStepLocation';
import { setFailure } from 'reducers/main';
import type { OsrdStdcmConfState, StandardAllowance } from 'reducers/osrdconf/types';
import { dateTimeFormatting } from 'utils/date';
import { kmhToMs, tToKg } from 'utils/physics';
import { minToMs, sec2ms } from 'utils/timeManipulation';

import createMargin from './createMargin';
import { StdcmStopTypes } from '../types';

type ValidStdcmConfig = {
  rollingStockId: number;
  towedRollingStockID?: number;
  timetableId: number;
  infraId: number;
  path: PathfindingItem[];
  speedLimitByTag?: string;
  totalMass?: number;
  totalLength?: number;
  maxSpeed?: number;
  margin?: StandardAllowance;
  gridMarginBefore?: number;
  gridMarginAfter?: number;
  workScheduleGroupId?: number;
  temporarySpeedLimitGroupId?: number;
  electricalProfileSetId?: number;
};

export const checkStdcmConf = (
  dispatch: Dispatch,
  t: TFunction,
  osrdconf: OsrdStdcmConfState
): ValidStdcmConfig | null => {
  const {
    stdcmPathSteps: pathSteps,
    timetableID,
    speedLimitByTag,
    infraID,
    rollingStockID,
    towedRollingStockID,
    margins: { standardAllowance, gridMarginBefore, gridMarginAfter },
    searchDatetimeWindow,
    workScheduleGroupId,
    temporarySpeedLimitGroupId,
    electricalProfileSetId,
    totalLength,
    totalMass,
    maxSpeed,
  } = osrdconf;
  let error = false;

  const origin = pathSteps.at(0)!;
  if (origin.isVia) {
    throw new Error('First step should not be a via');
  }
  const destination = pathSteps.at(-1)!;
  if (destination.isVia) {
    throw new Error('First step should not be a via');
  }

  if (!origin.location) {
    error = true;
    dispatch(
      setFailure({
        name: t('operationalStudies/manageTrainSchedule:errorMessages.trainScheduleTitle'),
        message: t('operationalStudies/manageTrainSchedule:errorMessages.noOrigin'),
      })
    );
  }
  if (!destination.location) {
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

  const originArrival = origin.arrival;
  const destinationArrival = destination.arrival;
  const isDepartureScheduled = origin.arrivalType === 'preciseTime';

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
          low: dateTimeFormatting(searchDatetimeWindow.begin, false),
          high: dateTimeFormatting(searchDatetimeWindow.end, false),
        }),
      })
    );
  }

  if (pathSteps.some((step) => !step.location)) {
    error = true;
    dispatch(
      setFailure({
        name: t('stdcm:form.incompleteForm'),
        message: t('stdcm:form.viaNotDefined'),
      })
    );
  }

  if (error) return null;

  const path = compact(osrdconf.stdcmPathSteps).map((step) => {
    const location = getStepLocation(step.location!);

    let timingData: PathfindingItem['timing_data'] | undefined;
    let duration: number | undefined;
    if (step.isVia) {
      const { stopFor } = step;
      if (step.stopType !== StdcmStopTypes.PASSAGE_TIME && stopFor !== undefined) {
        duration = minToMs(stopFor);
      }
    } else {
      // if the step is either the origin or the destination,
      // it must have a duration (because it's a stop)
      duration = 0;

      const { arrival, tolerances, arrivalType } = step;
      if (arrivalType === 'preciseTime' && arrival) {
        timingData = {
          arrival_time: arrival.toISOString(),
          arrival_time_tolerance_before: tolerances?.before?.ms ?? 0,
          arrival_time_tolerance_after: tolerances?.after?.ms ?? 0,
        };
      }
    }

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
    path,
    speedLimitByTag,
    totalMass,
    totalLength,
    maxSpeed,
    towedRollingStockID,
    margin: standardAllowance,
    gridMarginBefore,
    gridMarginAfter,
    workScheduleGroupId,
    temporarySpeedLimitGroupId,
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
    comfort: 'STANDARD',
    margin: createMargin(validConfig.margin),
    rolling_stock_id: validConfig.rollingStockId,
    towed_rolling_stock_id: validConfig.towedRollingStockID,
    speed_limit_tags: validConfig.speedLimitByTag,
    total_mass: validConfig.totalMass ? tToKg(validConfig.totalMass) : undefined,
    max_speed: validConfig.maxSpeed ? kmhToMs(validConfig.maxSpeed) : undefined,
    total_length: validConfig.totalLength,
    steps: validConfig.path,
    time_gap_after: toMsOrUndefined(validConfig.gridMarginBefore),
    time_gap_before: toMsOrUndefined(validConfig.gridMarginAfter),
    work_schedule_group_id: validConfig.workScheduleGroupId,
    temporary_speed_limit_group_id: validConfig.temporarySpeedLimitGroupId,
    electrical_profile_set_id: validConfig.electricalProfileSetId,
    loading_gauge_type: 'GA', // default value as the user can't select one
  },
});
