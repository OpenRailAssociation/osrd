import rollingstockGraou2OSRD from 'applications/graou/components/rollingstock_graou2osrd.json';

export default function generatePathfindingPayload(
  infraID,
  rollingStockID,
  trainsWithPathRef,
  pathsDictionnary,
  pointsDictionnary,
  rollingStockDB
) {
  const pathsToGenerate = {};
  pathsDictionnary.forEach((pathRef) => {
    const trainFromPathRef = trainsWithPathRef.find((train) => train.num === pathRef.num);
    const rollingStockFound = rollingStockDB.find(
      (rollingstock) => rollingstock.name === rollingstockGraou2OSRD[trainFromPathRef.type_em]
    );
    pathsToGenerate[pathRef.num] = {
      infra: infraID,
      rolling_stocks: [rollingStockFound ? rollingStockFound.id : rollingStockID],
      steps: trainFromPathRef.etapes.map((step, idx) => ({
        duration: idx === 0 || idx === trainFromPathRef.etapes.length - 1 ? 0 : step.duree,
        waypoints: [
          {
            track_section: pointsDictionnary[step.uic].trackSectionId,
            geo_coordinate: [Number(step.lon), Number(step.lat)],
          },
        ],
      })),
    };
  });
  return pathsToGenerate;
}
