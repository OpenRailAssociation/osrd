import { time2sec } from 'utils/timeManipulation';

export default function formatStdcmConf(dispatch, setFailure, t, osrdconf) {
  let error = false;
  if (!osrdconf.origin && osrdconf.stdcmMode === 'byOrigin') {
    error = true;
    dispatch(
      setFailure({
        name: t('osrdconf:errorMessages.trainScheduleTitle'),
        message: t('osrdconf:errorMessages.noOrigin'),
      })
    );
  }
  if (!osrdconf.originTime && osrdconf.stdcmMode === 'byOrigin') {
    error = true;
    dispatch(
      setFailure({
        name: t('osrdconf:errorMessages.trainScheduleTitle'),
        message: t('osrdconf:errorMessages.noOriginTime'),
      })
    );
  }
  if (!osrdconf.destination && osrdconf.stdcmMode === 'byDestination') {
    error = true;
    dispatch(
      setFailure({
        name: t('osrdconf:errorMessages.trainScheduleTitle'),
        message: t('osrdconf:errorMessages.noDestination'),
      })
    );
  }
  if (!osrdconf.destinationTime && osrdconf.stdcmMode === 'byDestination') {
    error = true;
    dispatch(
      setFailure({
        name: t('osrdconf:errorMessages.trainScheduleTitle'),
        message: t('osrdconf:errorMessages.noOriginTime'),
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
  if (!osrdconf.infraID) {
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

  // Demander: on indique si c'est par origin ou destination en mettant null sur l'autre ?
  // Demander: format de date
  // Demander: pourquoi tableaux

  const originDate = osrdconf.originTime ? time2sec(osrdconf.originTime) : null;
  const destinationDate = osrdconf.destinationTime ? time2sec(osrdconf.destinationTime) : null;

  if (!error) {
    const osrdConfStdcm = {
      infra: osrdconf.infraID,
      rolling_stock: osrdconf.rollingStockID,
      timetable: osrdconf.timetableID,
      start_time: originDate, // Build a date
      end_time: destinationDate, // Build a date
      start_points: [{
        track_section: osrdconf.origin.id,
        geo_coordinate: osrdconf.origin.clickLngLat,
      }],
      end_points: [{
        track_section: osrdconf.destination.id,
        geo_coordinate: osrdconf.destination.clickLngLat,
      }],
    };
    return osrdConfStdcm;
  }
  return false;
}
