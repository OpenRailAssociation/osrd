export default function formatConf(setErrorMessages, t, osrdconf) {
  const errorMessages = [];

  if (osrdconf.origin === undefined) {
    errorMessages.push(t('osrdconf:errorMessages.noOrigin'));
  }
  if (osrdconf.originTime === undefined) {
    errorMessages.push(t('osrdconf:errorMessages.noOriginTime'));
  }
  if (osrdconf.destination === undefined) {
    errorMessages.push(t('osrdconf:errorMessages.noDestination'));
  }
  /* if (osrdconf.trainCompo === undefined) {
    errorMessages.push(t('osrdconf:errorMessages.noTrainCompo'));
  } */
  if (osrdconf.name === '') {
    errorMessages.push(t('osrdconf:errorMessages.noName'));
  }
  if (osrdconf.timetableID === undefined) {
    errorMessages.push(t('osrdconf:errorMessages.noTimetable'));
  }

  if (errorMessages.length === 0) {
    /* const stops = osrdconf.vias.length === 0
      ? []
      : osrdconf.vias.map((via) => ({
        id: via.idGaia,
        stop_time: via.stoptime,
        time: via?.time,
      }));

    const regex = /'/g;
    const curveJson = JSON.parse(osrdconf.trainCompo.courbeeffortvitesse.replace(regex, '"'));
    const tractiveEffortCurve = [];
    Object.keys(curveJson).forEach((key) => {
      tractiveEffortCurve.push([key, curveJson[key]]);
    }); */

    const osrdConfSchedule = {
      train_name: osrdconf.name,
      departure_time: 0,
      phases: [],
      initial_speed: 0,
      timetable: osrdconf.timetableID,
      rolling_stock: 1,
      path: osrdconf.pathfindingID,
    };

    return osrdConfSchedule;
  }
  setErrorMessages(errorMessages);
  return false;
}
