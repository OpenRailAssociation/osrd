import type { PathWaypoint, ProjectionWaypoint } from 'modules/simulationResult/types';

const HIGHEST_PRIORITY_WEIGHT = 100;

/**
 * For each waypoints along side the train itinerary, check if the waypoint is a path item and set its weight
 * to the highest priority.
 */
export const applyPathStepWeight = <T extends PathWaypoint | ProjectionWaypoint>(
  waypoints: T[]
): T[] =>
  waypoints.map((waypoint) => ({
    ...waypoint,
    weight: waypoint.pathItemId ? HIGHEST_PRIORITY_WEIGHT : waypoint.weight,
  }));
