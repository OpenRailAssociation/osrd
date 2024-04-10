import { compact, isEmpty } from 'lodash';

import type { Step, TrainScheduleWithPathRef } from 'applications/operationalStudies/types';
import type { LightRollingStock } from 'common/api/osrdEditoastApi';
import rollingstockOpenData2OSRD from 'modules/trainschedule/components/ImportTrainSchedule/rollingstock_opendata2osrd.json';
import { isFirstOrLastElement } from 'utils/array';

import type { Point } from './types';

const getTrainAndRollingStockFromPath = (
  trainNumber: string,
  trainsWithPathRef: TrainScheduleWithPathRef[],
  rollingStocks: LightRollingStock[],
  defaultRollingStockId: number | undefined
) => {
  const trainFromPathRef = trainsWithPathRef.find((train) => train.trainNumber === trainNumber);

  if (!trainFromPathRef) {
    throw new Error('Train not found in trainsWithPathRef (getTrainAndRollingStockFromPath)');
  }

  const rollingStock = rollingStocks.find(
    (rollingstock) =>
      rollingstock.name ===
      rollingstockOpenData2OSRD[
        trainFromPathRef.rollingStock as keyof typeof rollingstockOpenData2OSRD
      ]
  );

  const rollingStockId = rollingStock ? rollingStock.id : defaultRollingStockId;
  if (!rollingStockId) {
    throw new Error('No default rollingStockId provided');
  }

  return {
    train: trainFromPathRef,
    rollingStockId,
  };
};

/**
 * Create Pathfinding payload with custom points.
 * Transform the steps into waypoints using the custom points. If a step has no custom point, then it is ignored.
 */
const generateWaypointFromCustomPoints = (step: Step, customPoints: Record<string, Point>) => {
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
const generateAutocompleteWaypoints = (step: Step) => {
  if (isEmpty(step.tracks)) {
    return [];
  }
  return step.tracks?.map((trackPosition) => ({
    track_section: trackPosition.track,
    offset: trackPosition.position,
  }));
};

const generatePathfindingPayload = (
  trainsWithPathRef: TrainScheduleWithPathRef[],
  rollingStocks: LightRollingStock[],
  trainNumber: string,
  defaultRollingStockId: number | undefined,
  infraId: number,
  autocomplete = true,
  pointsDictionnary: Record<string, Point> = {}
) => {
  const { train, rollingStockId } = getTrainAndRollingStockFromPath(
    trainNumber,
    trainsWithPathRef,
    rollingStocks,
    defaultRollingStockId
  );

  const invalidSteps = [];
  const steps = compact(
    train.steps.map((step) => {
      const waypoints = autocomplete
        ? generateAutocompleteWaypoints(step)
        : generateWaypointFromCustomPoints(step, pointsDictionnary);
      if (isEmpty(waypoints)) {
        invalidSteps.push(step);
        return null;
      }
      const isFirstOrLastStep = isFirstOrLastElement(train.steps, step);
      return {
        duration: isFirstOrLastStep || !step.duration ? 0 : step.duration,
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
