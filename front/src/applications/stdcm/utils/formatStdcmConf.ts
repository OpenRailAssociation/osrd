import type { TFunction } from 'i18next';
import { compact } from 'lodash';
import type { Dispatch } from 'redux';

import type {
  ConsistSchedule,
  PathfindingItem,
  PostTimetableByIdStdcmApiArg,
} from 'common/api/osrdEditoastApi';
import { setFailure } from 'reducers/main';
import type { OsrdStdcmConfState, StandardAllowance } from 'reducers/osrdconf/types';
import type { Duration } from 'utils/duration';
import { kmhToMs, tToKg } from 'utils/physics';

import { stdcmPathStepToPathItemLocation } from '.';
import { StdcmStopTypes } from '../types';
import createMargin from './createMargin';

type ValidStdcmConfig = {
  timetableId: number;
  infraId: number;
  path: PathfindingItem[];
  margin?: StandardAllowance;
  gridMarginBefore?: Duration;
  gridMarginAfter?: Duration;
  workScheduleGroupId?: number;
  temporarySpeedLimitGroupId?: number;
  electricalProfileSetId?: number;
  allowedTrackSections?: string[];
  consistSchedule: ConsistSchedule;
};

export const checkStdcmConf = (
  dispatch: Dispatch,
  t: TFunction,
  dateTimeLocale: Intl.Locale,
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
    loadingGauge,
    trackSectionIdsByLoadingGauge,
  } = osrdconf;
  let error = false;

  const allowedTrackSections =
    trackSectionIdsByLoadingGauge && loadingGauge
      ? trackSectionIdsByLoadingGauge[loadingGauge]
      : undefined;

  const origin = pathSteps.at(0)!;
  if (origin.isVia) {
    throw new Error('First step should not be a via');
  }
  const destination = pathSteps.at(-1)!;
  if (destination.isVia) {
    throw new Error('First step should not be a via');
  }

  if (!origin.operationalPoint) {
    error = true;
    dispatch(
      setFailure({
        name: t('operational-studies:manageTrainSchedule.errorMessages.trainScheduleTitle'),
        message: t('operational-studies:manageTrainSchedule.errorMessages.noOrigin'),
      })
    );
  }
  if (!destination.operationalPoint) {
    error = true;
    dispatch(
      setFailure({
        name: t('operational-studies:manageTrainSchedule.errorMessages.trainScheduleTitle'),
        message: t('operational-studies:manageTrainSchedule.errorMessages.noDestination'),
      })
    );
  }
  if (!rollingStockID) {
    error = true;
    dispatch(
      setFailure({
        name: t('operational-studies:manageTrainSchedule.errorMessages.trainScheduleTitle'),
        message: t('operational-studies:manageTrainSchedule.errorMessages.noRollingStock'),
      })
    );
  }
  if (!infraID) {
    error = true;
    dispatch(
      setFailure({
        name: t('operational-studies:manageTrainSchedule.errorMessages.trainScheduleTitle'),
        message: t('operational-studies:manageTrainSchedule.errorMessages.noName'),
      })
    );
  }
  if (!timetableID) {
    error = true;
    dispatch(
      setFailure({
        name: t('operational-studies:manageTrainSchedule.errorMessages.trainScheduleTitle'),
        message: t('operational-studies:manageTrainSchedule.errorMessages.noTimetable'),
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
        name: t('operational-studies:manageTrainSchedule.errorMessages.trainScheduleTitle'),
        message: t(
          'operational-studies:manageTrainSchedule.errorMessages.originTimeOutsideWindow',
          {
            low: searchDatetimeWindow.begin.toLocaleString(dateTimeLocale, { dateStyle: 'medium' }),
            high: searchDatetimeWindow.end.toLocaleString(dateTimeLocale, { dateStyle: 'medium' }),
          }
        ),
      })
    );
  }

  if (pathSteps.some((step) => !step.operationalPoint)) {
    error = true;
    dispatch(
      setFailure({
        name: t('stdcm:form.incompleteForm'),
        message: t('stdcm:form.viaNotDefined'),
      })
    );
  }

  const path = compact(osrdconf.stdcmPathSteps).map((step) => {
    const formattedLocation = stdcmPathStepToPathItemLocation(step.operationalPoint);

    let timingData: PathfindingItem['timing_data'] | undefined;
    let duration: number | undefined;
    if (step.isVia) {
      const { stopFor } = step;
      if (step.stopType !== StdcmStopTypes.PASSAGE_TIME && stopFor !== undefined) {
        duration = stopFor.ms;
      }
    } else {
      // if the step is either the origin or the destination,
      // it must have a duration (because it's a stop)
      duration = 0;

      const { arrival, tolerances, arrivalType } = step;
      if (arrivalType === 'preciseTime' && arrival) {
        timingData = {
          arrival_time: arrival.toISOString(),
          arrival_time_tolerance_before: tolerances.before.ms,
          arrival_time_tolerance_after: tolerances.after.ms,
        };
      }
    }

    return {
      duration,
      location: formattedLocation,
      timing_data: timingData,
    };
  });

  const initialConsist = {
    rolling_stock_id: rollingStockID!,
    towed_rolling_stock_id: towedRollingStockID,
    total_mass: totalMass ? tToKg(totalMass) : undefined,
    total_length: totalLength,
    max_speed: maxSpeed ? kmhToMs(maxSpeed) : undefined,
    loading_gauge_type: loadingGauge,
    speed_limit_tag: speedLimitByTag,
  };

  const boundaries: number[] = [];
  const consistValues = [initialConsist];

  for (const [index, step] of pathSteps.entries()) {
    if (!step.isVia || !step.consistChange) continue;
    if (!step.consistChange.rollingStockID) {
      error = true;
      dispatch(
        setFailure({
          name: t('stdcm:form.incompleteForm'),
          message: t('stdcm:form.viaRollingStockMissing'),
        })
      );

      break;
    }

    boundaries.push(index);
    consistValues.push({
      rolling_stock_id: step.consistChange.rollingStockID,
      towed_rolling_stock_id: step.consistChange.towedRollingStockID,
      total_mass: step.consistChange.totalMass ? tToKg(step.consistChange.totalMass) : undefined,
      total_length: step.consistChange.totalLength,
      max_speed: step.consistChange.maxSpeed ? kmhToMs(step.consistChange.maxSpeed) : undefined,
      speed_limit_tag: step.consistChange.speedLimitByTag,
      loading_gauge_type: step.consistChange.loadingGauge,
    });
  }

  if (error) return null;

  const consistSchedule = { boundaries, values: consistValues };

  return {
    infraId: infraID!,
    timetableId: timetableID!,
    path,
    margin: standardAllowance,
    gridMarginBefore,
    gridMarginAfter,
    workScheduleGroupId,
    temporarySpeedLimitGroupId,
    electricalProfileSetId,
    allowedTrackSections,
    consistSchedule,
  };
};

export const formatStdcmPayload = (
  validConfig: ValidStdcmConfig
): PostTimetableByIdStdcmApiArg => ({
  infra: validConfig.infraId,
  id: validConfig.timetableId,
  body: {
    comfort: 'STANDARD',
    margin: createMargin(validConfig.margin),
    steps: validConfig.path,
    time_gap_after: validConfig.gridMarginBefore?.ms,
    time_gap_before: validConfig.gridMarginAfter?.ms,
    work_schedule_group_id: validConfig.workScheduleGroupId,
    temporary_speed_limit_group_id: validConfig.temporarySpeedLimitGroupId,
    electrical_profile_set_id: validConfig.electricalProfileSetId,
    allowed_track_sections: validConfig.allowedTrackSections,
    consist_schedule: validConfig.consistSchedule,
  },
});
