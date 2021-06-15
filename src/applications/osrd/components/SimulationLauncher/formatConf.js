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
  if (osrdconf.trainCompo === undefined) {
    errorMessages.push(t('osrdconf:errorMessages.noTrainCompo'));
  }
  if (osrdconf.name === '') {
    errorMessages.push(t('osrdconf:errorMessages.noName'));
  }

  if (errorMessages.length === 0) {
    const stops = osrdconf.vias.length === 0
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
    });

    const osrdConfSimu = {
      name: osrdconf.name,
      starting_speed: 0,
      signaling_type: 'BAL3',
      from: {
        id: osrdconf.origin.idGaia,
        time: osrdconf.originTime,
      },
      to: {
        id: osrdconf.destination.idGaia,
      },
      stops,
      rolling_stock: {
        coeffvoma: osrdconf.trainCompo.coeffvoma,
        coeffvomb: osrdconf.trainCompo.coeffvomb,
        coeffvomc: osrdconf.trainCompo.coeffvomc,
        mass: osrdconf.trainCompo.etatchargevom,
        length: osrdconf.trainCompo.longueurconvoi,
        rottating_mass: osrdconf.trainCompo.coeffinertiemassestournantes,
        max_speed: osrdconf.trainCompo.vitessmax,
        tractive_effort_curve: tractiveEffortCurve,
      },
    };

    if (osrdconf.destinationTime !== undefined && osrdconf.destinationTime !== '') {
      osrdConfSimu.to.time = osrdconf.destinationTime;
    }
    return osrdConfSimu;
  }
  setErrorMessages(errorMessages);
  return false;
}
