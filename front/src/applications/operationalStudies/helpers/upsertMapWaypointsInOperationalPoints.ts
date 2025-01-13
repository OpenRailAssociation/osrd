/* eslint-disable import/prefer-default-export */
import type { TFunction } from 'i18next';

import type { PathfindingResultSuccess, TrainScheduleResult } from 'common/api/osrdEditoastApi';

import type { OperationalPoint } from '../types';

const HIGHEST_PRIORITY_WEIGHT = 100;

/**
 * Check if the train path used waypoints added by map click and add them to the operational points
 */
export const upsertMapWaypointsInOperationalPoints = (
  path: TrainScheduleResult['path'],
  pathItemsPositions: PathfindingResultSuccess['path_item_positions'],
  operationalPoints: OperationalPoint[],
  t: TFunction
): OperationalPoint[] => {
  let waypointCounter = 1;

  return path.reduce(
    (operationalPointsWithAllWaypoints, step, i) => {
      if ('uic' in step) {
        const matchedIndex = operationalPointsWithAllWaypoints.findIndex(
          (op) =>
            'uic' in step &&
            'secondary_code' in step &&
            step.uic === op.extensions?.identifier?.uic &&
            step.secondary_code === op.extensions?.sncf?.ch
        );

        if (matchedIndex !== -1) {
          // Replace the operational point at its original index with updated weight
          operationalPointsWithAllWaypoints[matchedIndex] = {
            ...operationalPointsWithAllWaypoints[matchedIndex],
            weight: HIGHEST_PRIORITY_WEIGHT,
          };
        }

        return operationalPointsWithAllWaypoints;
      }

      if ('track' in step) {
        const positionOnPath = pathItemsPositions[i];
        const indexToInsert = operationalPointsWithAllWaypoints.findIndex(
          (op) => op.position >= positionOnPath
        );

        const formattedStep: OperationalPoint = {
          id: step.id,
          extensions: {
            identifier: {
              name: t('requestedPoint', { count: waypointCounter }),
              uic: 0,
            },
          },
          part: { track: step.track, position: step.offset },
          position: positionOnPath,
          weight: HIGHEST_PRIORITY_WEIGHT,
        };

        waypointCounter += 1;

        // If we can't find any op position greater than the current step position, we add it at the end
        if (indexToInsert === -1) {
          operationalPointsWithAllWaypoints.push(formattedStep);
        } else {
          operationalPointsWithAllWaypoints.splice(indexToInsert, 0, formattedStep);
        }

        return operationalPointsWithAllWaypoints;
      }
      return operationalPointsWithAllWaypoints;
    },
    [...operationalPoints]
  );
};
