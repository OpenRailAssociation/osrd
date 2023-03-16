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
      train.steps
        .map((step, idx) =>
          idx === 0 || idx === step.length - 1
            ? `${step.latitude}${step.longitude}`
            : `0${step.latitude}${step.longitude}`
        )
        .join() + rollingstockOpenData2OSRD[train.rollingStock];
    const pathRef = pathsDictionnary.find((entry) => entry.pathString === pathString);
    if (pathRef === undefined) {
      pathsDictionnary.push({
        trainNumber: train.trainNumber,
        pathString,
      });
      trainsWithPathRef.push({ ...train, pathRef: train.trainNumber });
    } else {
      trainsWithPathRef.push({ ...train, pathRef: pathRef.trainNumber });
    }
    train.steps.forEach((step) => {
      pointsList[step.uic] = {
        longitude: step.longitude,
        latitude: step.latitude,
        name: step.gare,
      };
    });
  });
  setTrainsWithPathRef(trainsWithPathRef);
  setPathsDictionnary(pathsDictionnary);
  setPointsDictionnary(pointsList);
}
