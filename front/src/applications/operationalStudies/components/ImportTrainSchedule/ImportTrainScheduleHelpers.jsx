import rollingstockOpenData2OSRD from 'applications/operationalStudies/components/ImportTrainSchedule/rollingstock_opendata2osrd.json';

export function seconds2hhmmss(seconds) {
  const dateTime = new Date(seconds * 1000);
  return dateTime.toJSON().substring(11, 19);
}

// Look for unique pathways by concatenation of duration & coordinates
// Compare them & create dictionnary, associate reference of unique path to each train
export function refactorUniquePaths(
  trains,
  setTrainsWithPathRef,
  setPathsDictionnary,
  setPointsDictionnary
) {
  const pathsDictionnary = [];
  const trainsWithPathRef = [];
  const pointsList = {};
  trains.forEach((train) => {
    const pathString =
      train.etapes
        .map((step, idx) =>
          idx === 0 || idx === step.length - 1
            ? `${step.duree}${step.lat}${step.lon}`
            : `0${step.lat}${step.lon}`
        )
        .join() + rollingstockOpenData2OSRD[train.type_em];
    const pathRef = pathsDictionnary.find((entry) => entry.pathString === pathString);
    if (pathRef === undefined) {
      pathsDictionnary.push({
        num: train.num,
        pathString,
      });
      trainsWithPathRef.push({ ...train, pathRef: train.num });
    } else {
      trainsWithPathRef.push({ ...train, pathRef: pathRef.num });
    }
    train.etapes.forEach((step) => {
      pointsList[step.uic] = { lng: step.lon, lat: step.lat, name: step.gare };
    });
  });
  setTrainsWithPathRef(trainsWithPathRef);
  setPathsDictionnary(pathsDictionnary);
  setPointsDictionnary(pointsList);
}
