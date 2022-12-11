import rollingstockOpenData2OSRD from 'applications/opendata/components/rollingstock_opendata2osrd.json';

function formatSteps(pointsDictionnary, trainFromPathRef, autoComplete) {
  if (autoComplete) {
    return trainFromPathRef.etapes.map((step, idx) => ({
      duration: idx === 0 || idx === trainFromPathRef.etapes.length - 1 ? 0 : step.duree,
      op_trigram: step.code,
    }));
  }
  return trainFromPathRef.etapes.map((step, idx) => ({
    duration: idx === 0 || idx === trainFromPathRef.etapes.length - 1 ? 0 : step.duree,
    waypoints: [
      {
        track_section: pointsDictionnary[step.uic].trackSectionId,
        geo_coordinate: [Number(step.lon), Number(step.lat)],
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
    const trainFromPathRef = trainsWithPathRef.find((train) => train.num === pathRef.num);
    const rollingStockFound = rollingStockDB.find(
      (rollingstock) => rollingstock.name === rollingstockOpenData2OSRD[trainFromPathRef.type_em]
    );
    pathsToGenerate[pathRef.num] = {
      infra: infraID,
      rolling_stocks: [rollingStockFound ? rollingStockFound.id : rollingStockID],
      steps: formatSteps(pointsDictionnary, trainFromPathRef, autoComplete),
    };
  });
  return pathsToGenerate;
}
