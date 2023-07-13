import { compact, isEmpty } from 'lodash';
import rollingstockOpenData2OSRD from 'applications/operationalStudies/components/ImportTrainSchedule/rollingstock_opendata2osrd.json';

const getTrainAndRollingStockFromPath = (
  path,
  trainsWithPathRef,
  rollingStockDB,
  defaultRollingStockId
) => {
  const trainFromPathRef = trainsWithPathRef.find(
    (train) => train.trainNumber === path.trainNumber
  );

  const rollingStockFound = rollingStockDB.find(
    (rollingstock) => rollingstock.name === rollingstockOpenData2OSRD[trainFromPathRef.rollingStock]
  );

  return {
    train: trainFromPathRef,
    rollingStockId: rollingStockFound ? rollingStockFound.id : defaultRollingStockId,
  };
};

/**
 * Create Autocomple Pathfinding payload from path.
 * Transform the steps into waypoints using the custom points. If a step has no custom point, then it is ignored.
 */
const createPathFindingPayloadWithCustomPoints = (train, rollingStockId, infraId, customPoints) => {
  const invalidSteps = [];
  const steps = compact(
    train.steps.map((step, idx) => {
      const isFirstOrLastStep = idx === 0 || idx === train.steps.length - 1;
      const { trackSectionId } = customPoints[step.uic];
      const longitude = Number(step.longitude);
      const latitude = Number(step.latitude);
      if (!trackSectionId || !longitude || !latitude) {
        invalidSteps.push(step);
        return null;
      }
      return {
        duration: isFirstOrLastStep ? 0 : step.duration,
        waypoints: [
          {
            track_section: trackSectionId,
            geo_coordinate: [longitude, latitude],
          },
        ],
      };
    })
  );
  if (invalidSteps.length > 0) {
    console.warn(`${invalidSteps.length} invalid steps for train number ${train.trainNumber}`);
  }
  return {
    infra: infraId,
    rolling_stocks: [rollingStockId],
    steps,
  };
};

/**
 * Create Autocomplete Pathfinding payload from path.
 * Transform the steps into waypoints from the first trackSection of each step. If a step has no trackSection, then it is ignored.
 */
const createAutocompletePathFindingPayload = (train, rollingStockId, infraId) => {
  const invalidSteps = [];
  const steps = compact(
    train.steps.map((step, idx) => {
      if (isEmpty(step.tracks)) {
        invalidSteps.push(step);
        return null;
      }
      const isFirstOrLastStep = idx === 0 || idx === train.steps.length - 1;
      return {
        duration: isFirstOrLastStep ? 0 : step.duration,
        waypoints: step.tracks.map((trackPosition) => ({
          track_section: trackPosition.track,
          offset: trackPosition.position,
        })),
      };
    })
  );
  if (invalidSteps.length > 0) {
    console.warn(`${invalidSteps.length} invalid steps for train number ${train.trainNumber}`);
  }
  return {
    infra: infraId,
    rolling_stocks: [rollingStockId],
    steps,
  };
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
  const payload = autocomplete
    ? createAutocompletePathFindingPayload(train, rollingStockId, infraId)
    : createPathFindingPayloadWithCustomPoints(train, rollingStockId, infraId, pointsDictionnary);
  return { payload, rollingStockId };
};

export default generatePathfindingPayload;
