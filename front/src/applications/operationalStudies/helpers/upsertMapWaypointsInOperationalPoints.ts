import type { TFunction } from 'i18next';

import type { CorePathfindingResultSuccess, TrainSchedule } from 'common/api/osrdEditoastApi';
import type { PathWaypoint, ProjectionWaypoint } from 'modules/simulationResult/types';

/**
 * Check if the train path used waypoints added by map click and add them to the operational points
 */
export function upsertMapWaypointsInOperationalPoints(
  type: 'projection',
  path: TrainSchedule['path'],
  pathItemsPositions: CorePathfindingResultSuccess['path_item_positions'],
  operationalPoints: ProjectionWaypoint[],
  t: TFunction<'operational-studies'>
): ProjectionWaypoint[];
export function upsertMapWaypointsInOperationalPoints(
  type: 'path',
  path: TrainSchedule['path'],
  pathItemsPositions: CorePathfindingResultSuccess['path_item_positions'],
  operationalPoints: PathWaypoint[],
  t: TFunction<'operational-studies'>
): PathWaypoint[];
export function upsertMapWaypointsInOperationalPoints(
  type: 'projection' | 'path',
  path: TrainSchedule['path'],
  pathItemsPositions: CorePathfindingResultSuccess['path_item_positions'],
  operationalPoints: (ProjectionWaypoint | PathWaypoint)[],
  t: TFunction<'operational-studies'>
): (ProjectionWaypoint | PathWaypoint)[] {
  return path.reduce(
    (operationalPointsWithAllWaypoints, step, stepIndex) => {
      const location = step.location;
      if (location.type !== 'track_offset') {
        return operationalPointsWithAllWaypoints;
      }

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
        waypointId: `pathitem-${step.id}`,
        opId: null,
        pathItemId: step.id,
        name: stepName,
        uic: 0,
        country_code: '??',
        is_passenger_station: false,
        main_code: '',
        position: positionOnPath,
        weight: null,
        location,
      };
      const formattedStep =
        type === 'projection'
          ? baseFormattedStep
          : {
              ...baseFormattedStep,
              part: { track: location.track, position: location.offset, local_track_name: 'V1' },
            };

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
}
