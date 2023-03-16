import rollingstockOpenData2OSRD from 'applications/operationalStudies/components/ImportTrainSchedule/rollingstock_opendata2osrd.json';

function formatSteps(pointsDictionnary, trainFromPathRef, autoComplete) {
  if (autoComplete) {
    return trainFromPathRef.steps.map((step, idx) => ({
      duration: idx === 0 || idx === trainFromPathRef.steps.length - 1 ? 0 : step.duration,
      op_trigram: step.trigram,
    }));
  }
  return trainFromPathRef.steps.map((step, idx) => ({
    duration: idx === 0 || idx === trainFromPathRef.steps.length - 1 ? 0 : step.duration,
    waypoints: [
      {
        track_section: pointsDictionnary[step.uic].trackSectionId,
        geo_coordinate: [Number(step.longitude), Number(step.latitude)],
      },
    ],
  }));
}

export default function generatePathfindingPayload(
  infraID,
  rollingStockID,
  trainsWithPathRef,
  pathsDictionnary,
  pointsDictionnary,
  rollingStockDB,
  autoComplete
) {
  const pathsToGenerate = {};
  pathsDictionnary.forEach((pathRef) => {
    const trainFromPathRef = trainsWithPathRef.find(
      (train) => train.trainNumber === pathRef.trainNumber
    );
    const rollingStockFound = rollingStockDB.find(
      (rollingstock) =>
        rollingstock.name === rollingstockOpenData2OSRD[trainFromPathRef.rollingStock]
    );
    pathsToGenerate[pathRef.trainNumber] = {
      infra: infraID,
      rolling_stocks: [rollingStockFound ? rollingStockFound.id : rollingStockID],
      steps: formatSteps(pointsDictionnary, trainFromPathRef, autoComplete),
    };
  });
  return pathsToGenerate;
}
