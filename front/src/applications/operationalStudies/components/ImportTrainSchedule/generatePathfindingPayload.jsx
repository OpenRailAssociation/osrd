import { compact, isEmpty } from 'lodash';
import rollingstockOpenData2OSRD from 'applications/operationalStudies/components/ImportTrainSchedule/rollingstock_opendata2osrd.json';
import { isFirstOrLastElement } from 'utils/array';

const getTrainAndRollingStockFromPath = (
  path,
  trainsWithPathRef,
  rollingStocks,
  defaultRollingStockId
) => {
  const trainFromPathRef = trainsWithPathRef.find(
    (train) => train.trainNumber === path.trainNumber
  );

  const rollingStock = rollingStocks.find(
    (rollingstock) => rollingstock.name === rollingstockOpenData2OSRD[trainFromPathRef.rollingStock]
  );

  return {
    train: trainFromPathRef,
    rollingStockId: rollingStock ? rollingStock.id : defaultRollingStockId,
  };
};

/**
 * Create Pathfinding payload with custom points.
 * Transform the steps into waypoints using the custom points. If a step has no custom point, then it is ignored.
 */
const generateWaypointFromCustomPoints = (step, customPoints) => {
  const { trackSectionId } = customPoints[step.uic];
  const longitude = Number(step.longitude);
  const latitude = Number(step.latitude);
  if (!trackSectionId || !longitude || !latitude) {
    return [];
  }
  return [
    {
      track_section: trackSectionId,
      geo_coordinate: [longitude, latitude],
    },
  ];
};

/**
 * Create Autocomplete Pathfinding payload from path.
 * Transform the steps into waypoints from the first trackSection of each step. If a step has no trackSection, then it is ignored.
 */
const generateAutocompleteWaypoints = (step) => {
  if (isEmpty(step.tracks)) {
    return [];
  }
  return step.tracks.map((trackPosition) => ({
    track_section: trackPosition.track,
    offset: trackPosition.position,
  }));
};

const generatePathfindingPayload = (
  trainsWithPathRef,
  rollingStockDB,
  path,
  defaultRollingStockId,
  infraId,
  autocomplete = true,
  pointsDictionnary = {}
) => {
  const { train, rollingStockId } = getTrainAndRollingStockFromPath(
    path,
    trainsWithPathRef,
    rollingStockDB,
    defaultRollingStockId
  );

  const invalidSteps = [];
  const stepsCount = train.steps.length;
  const steps = compact(
    train.steps.map((step, idx) => {
      const waypoints = autocomplete
        ? generateAutocompleteWaypoints(step)
        : generateWaypointFromCustomPoints(step, pointsDictionnary);
      if (isEmpty(waypoints)) {
        invalidSteps.push(step);
        return null;
      }
      const isFirstOrLastStep = isFirstOrLastElement(idx, stepsCount);
      return {
        duration: isFirstOrLastStep ? 0 : step.duration,
        waypoints,
      };
    })
  );
  if (invalidSteps.length > 0) {
    console.warn(`${invalidSteps.length} invalid steps for train number ${train.trainNumber}`);
  }

  const payload = {
    infra: infraId,
    rolling_stocks: [rollingStockId],
    steps,
  };
  return { payload, rollingStockId };
};

export default generatePathfindingPayload;
