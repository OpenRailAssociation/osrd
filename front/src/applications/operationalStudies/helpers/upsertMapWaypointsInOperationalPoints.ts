import type { TFunction } from 'i18next';

import type { CorePathfindingResultSuccess, TrainSchedule } from 'common/api/osrdEditoastApi';
import type {
  PathOperationalPoint,
  EditoastPathOperationalPoint,
} from 'modules/simulationResult/types';

const HIGHEST_PRIORITY_WEIGHT = 100;

/**
 * Check if the train path used waypoints added by map click and add them to the operational points
 */
export function upsertMapWaypointsInOperationalPoints(
  type: 'PathOperationalPoint',
  path: TrainSchedule['path'],
  pathItemsPositions: CorePathfindingResultSuccess['path_item_positions'],
  operationalPoints: PathOperationalPoint[],
  t: TFunction<'operational-studies'>
): PathOperationalPoint[];
export function upsertMapWaypointsInOperationalPoints(
  type: 'EditoastPathOperationalPoint',
  path: TrainSchedule['path'],
  pathItemsPositions: CorePathfindingResultSuccess['path_item_positions'],
  operationalPoints: EditoastPathOperationalPoint[],
  t: TFunction<'operational-studies'>
): EditoastPathOperationalPoint[];
export function upsertMapWaypointsInOperationalPoints(
  type: 'PathOperationalPoint' | 'EditoastPathOperationalPoint',
  path: TrainSchedule['path'],
  pathItemsPositions: CorePathfindingResultSuccess['path_item_positions'],
  operationalPoints: (PathOperationalPoint | EditoastPathOperationalPoint)[],
  t: TFunction<'operational-studies'>
): (PathOperationalPoint | EditoastPathOperationalPoint)[] {
  return path.reduce(
    (operationalPointsWithAllWaypoints, step, stepIndex) => {
      const location = step.location;
      if (location.type === 'track_offset') {
        const positionOnPath = pathItemsPositions[stepIndex];
        const indexToInsert = operationalPointsWithAllWaypoints.findIndex(
          (op) => op.position >= positionOnPath
        );
        let stepName = t('main.requestedPoint', { count: stepIndex });
        if (stepIndex === 0) {
          stepName = t('main.requestedOrigin');
        } else if (stepIndex === path.length - 1) {
          stepName = t('main.requestedDestination');
        }

        const baseFormattedStep = {
          extensions: {
            identifier: {
              name: stepName,
              uic: 0,
            },
          },
          part: { track: location.track, position: location.offset, local_track_name: 'V1' },
          position: positionOnPath,
          weight: HIGHEST_PRIORITY_WEIGHT,
        };
        const formattedStep =
          type === 'PathOperationalPoint'
            ? {
                ...baseFormattedStep,
                waypointId: step.id,
                opId: null,
              }
            : {
                ...baseFormattedStep,
                id: step.id,
              };

        // If we can't find any op position greater than the current step position, we add it at the end
        if (indexToInsert === -1) {
          operationalPointsWithAllWaypoints.push(formattedStep);
        } else {
          operationalPointsWithAllWaypoints.splice(indexToInsert, 0, formattedStep);
        }

        return operationalPointsWithAllWaypoints;
      }

      if (location.operational_point.type === 'uic') {
        const matchedIndex = operationalPointsWithAllWaypoints.findIndex(
          (op) =>
            location.operational_point.type === 'uic' &&
            location.operational_point.uic === op.extensions?.identifier?.uic &&
            location.operational_point.secondary_code === op.extensions?.sncf?.ch
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

      return operationalPointsWithAllWaypoints;
    },
    [...operationalPoints]
  );
}
