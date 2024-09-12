/* eslint-disable import/prefer-default-export */
import type { TFunction } from 'i18next';

import type {
  PathfindingResultSuccess,
  PathProperties,
  TrainScheduleResult,
} from 'common/api/osrdEditoastApi';

/**
 * Check if the train path used waypoints added by map click and add them to the operational points
 */
export const upsertMapWaypointsInOperationalPoints = (
  path: TrainScheduleResult['path'],
  pathItemsPositions: PathfindingResultSuccess['path_item_positions'],
  operationalPoints: NonNullable<PathProperties['operational_points']>,
  t: TFunction
): NonNullable<PathProperties['operational_points']> => {
  let waypointCounter = 1;

  return path.reduce(
    (operationalPointsWithAllWaypoints, step, i) => {
      if (!('track' in step)) return operationalPointsWithAllWaypoints;

      const positionOnPath = pathItemsPositions[i];
      const indexToInsert = operationalPointsWithAllWaypoints.findIndex(
        (op) => op.position >= positionOnPath
      );

      const formattedStep: NonNullable<PathProperties['operational_points']>[number] = {
        id: step.id,
        extensions: {
          identifier: {
            name: t('requestedPoint', { count: waypointCounter }),
            uic: 0,
          },
        },
        part: { track: step.track, position: step.offset },
        position: positionOnPath,
      };

      waypointCounter += 1;

      // If we can't find any op position greater than the current step position, we add it at the end
      if (indexToInsert === -1) {
        operationalPointsWithAllWaypoints.push(formattedStep);
      } else {
        operationalPointsWithAllWaypoints.splice(indexToInsert, 0, formattedStep);
      }

      return operationalPointsWithAllWaypoints;
    },
    [...operationalPoints]
  );
};
