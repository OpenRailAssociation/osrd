import { setFailure } from 'reducers/main';
import { OsrdConfState } from 'applications/operationalStudies/consts';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function formatConf(dispatch: any, t: any, osrdconf: OsrdConfState) {
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
  if (!osrdconf.originTime) {
    error = true;
    dispatch(
      setFailure({
        name: t('errorMessages.trainScheduleTitle'),
        message: t('errorMessages.noOriginTime'),
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

  if (!error) {
    const osrdConfSchedule = {
      train_name: osrdconf.name,
      labels: osrdconf.labels,
      departure_time: osrdconf.originTime,
      initial_speed: Math.abs(osrdconf.initialSpeed / 3.6),
      rolling_stock: osrdconf.rollingStockID,
      comfort: osrdconf.rollingStockComfort,
      speed_limit_tags: osrdconf.speedLimitByTag,
      power_restriction_ranges: osrdconf.powerRestriction,
      options: {
        ignore_electrical_profiles: !osrdconf.usingElectricalProfiles,
      },
    };
    return osrdConfSchedule;
  }
  return false;
}
