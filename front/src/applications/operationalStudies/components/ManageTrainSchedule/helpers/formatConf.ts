import { setFailure } from 'reducers/main';
import { OsrdConfState } from 'applications/operationalStudies/consts';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function formatConf(dispatch: any, t: any, osrdconf: OsrdConfState) {
  let error = false;
  if (!osrdconf.origin) {
    error = true;
    dispatch(
      setFailure({
        name: t('osrdconf:errorMessages.trainScheduleTitle'),
        message: t('osrdconf:errorMessages.noOrigin'),
      })
    );
  }
  if (!osrdconf.originTime) {
    error = true;
    dispatch(
      setFailure({
        name: t('osrdconf:errorMessages.trainScheduleTitle'),
        message: t('osrdconf:errorMessages.noOriginTime'),
      })
    );
  }
  if (!osrdconf.destination) {
    error = true;
    dispatch(
      setFailure({
        name: t('osrdconf:errorMessages.trainScheduleTitle'),
        message: t('osrdconf:errorMessages.noDestination'),
      })
    );
  }
  if (!osrdconf.rollingStockID) {
    error = true;
    dispatch(
      setFailure({
        name: t('osrdconf:errorMessages.trainScheduleTitle'),
        message: t('osrdconf:errorMessages.noRollingStock'),
      })
    );
  }
  if (!osrdconf.name) {
    error = true;
    dispatch(
      setFailure({
        name: t('osrdconf:errorMessages.trainScheduleTitle'),
        message: t('osrdconf:errorMessages.noName'),
      })
    );
  }
  if (!osrdconf.timetableID) {
    error = true;
    dispatch(
      setFailure({
        name: t('osrdconf:errorMessages.trainScheduleTitle'),
        message: t('osrdconf:errorMessages.noTimetable'),
      })
    );
  }

  if (!error) {
    const osrdConfSchedule = {
      train_name: osrdconf.name,
      labels: osrdconf.labels,
      departure_time: osrdconf.originTime,
      initial_speed: Math.abs(osrdconf.originSpeed / 3.6),
      rolling_stock: osrdconf.rollingStockID,
      comfort: osrdconf.rollingStockComfort,
      speed_limit_tags: osrdconf.speedLimitByTag,
    };
    return osrdConfSchedule;
  }
  return false;
}
