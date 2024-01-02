import { isEmpty } from 'lodash';
import { Dispatch } from 'redux';
import { formatAllowances } from 'modules/trainschedule/components/ManageTrainSchedule/Allowances/helpers';
import { NO_POWER_RESTRICTION } from 'modules/trainschedule/components/ManageTrainSchedule/PowerRestrictionsSelector';
import { setFailure } from 'reducers/main';
import { time2sec } from 'utils/timeManipulation';
import { kmhToMs } from 'utils/physics';
import type { PowerRestrictionRange } from 'applications/operationalStudies/consts';
import type { OsrdConfState } from 'reducers/osrdconf/consts';

const formatPowerRestrictionRanges = (powerRestrictionRanges: PowerRestrictionRange[]) => {
  if (isEmpty(powerRestrictionRanges) || powerRestrictionRanges[0].value === NO_POWER_RESTRICTION) {
    return null;
  }
  return powerRestrictionRanges
    .filter((powerRestrictionRange) => powerRestrictionRange.value !== NO_POWER_RESTRICTION)
    .map((powerRestrictionRange) => ({
      begin_position: powerRestrictionRange.begin,
      end_position: powerRestrictionRange.end,
      power_restriction_code: powerRestrictionRange.value,
    }));
};

export default function formatConf(
  dispatch: Dispatch,
  t: (arg0: string) => string,
  osrdconf: OsrdConfState,
  ignoreTrainAddSettings = false
) {
  let error = false;
  if (!osrdconf.origin) {
    error = true;
    dispatch(
      setFailure({
        name: t('errorMessages.trainScheduleTitle'),
        message: t('errorMessages.noOrigin'),
      })
    );
  }
  if (!osrdconf.departureTime) {
    error = true;
    dispatch(
      setFailure({
        name: t('errorMessages.trainScheduleTitle'),
        message: t('errorMessages.noDepartureTime'),
      })
    );
  }
  if (!osrdconf.destination) {
    error = true;
    dispatch(
      setFailure({
        name: t('errorMessages.trainScheduleTitle'),
        message: t('errorMessages.noDestination'),
      })
    );
  }
  if (!osrdconf.rollingStockID) {
    error = true;
    dispatch(
      setFailure({
        name: t('errorMessages.trainScheduleTitle'),
        message: t('errorMessages.noRollingStock'),
      })
    );
  }
  if (!osrdconf.name) {
    error = true;
    dispatch(
      setFailure({
        name: t('errorMessages.trainScheduleTitle'),
        message: t('errorMessages.noName'),
      })
    );
  }
  if (!osrdconf.timetableID) {
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
    if (osrdconf.trainCount < 1) {
      error = true;
      dispatch(
        setFailure({
          name: t('errorMessages.trainScheduleTitle'),
          message: t('errorMessages.noTrainCount'),
        })
      );
    }
    if (osrdconf.trainDelta < 1) {
      error = true;
      dispatch(
        setFailure({
          name: t('errorMessages.trainScheduleTitle'),
          message: t('errorMessages.noDelta'),
        })
      );
    }
    if (osrdconf.trainStep < 1) {
      error = true;
      dispatch(
        setFailure({
          name: t('errorMessages.trainScheduleTitle'),
          message: t('errorMessages.noTrainStep'),
        })
      );
    }
  }

  if (!error) {
    const osrdConfSchedule = {
      train_name: osrdconf.name,
      labels: osrdconf.labels,
      departure_time: time2sec(osrdconf.departureTime),
      allowances: formatAllowances(osrdconf.allowances),
      initial_speed: osrdconf.initialSpeed ? kmhToMs(osrdconf.initialSpeed) : 0,
      rolling_stock_id: osrdconf.rollingStockID as number,
      comfort: osrdconf.rollingStockComfort,
      speed_limit_tags: osrdconf.speedLimitByTag,
      power_restriction_ranges: formatPowerRestrictionRanges(osrdconf.powerRestrictionRanges),
      options: {
        ignore_electrical_profiles: !osrdconf.usingElectricalProfiles,
      },
    };
    return osrdConfSchedule;
  }
  return false;
}
