import { matchPathStepAndOp } from 'modules/pathfinding/utils';
import type { SuggestedOP } from 'modules/trainSchedule/types';
import type { PathStepV2 } from 'reducers/osrdconf/types';

import type { WaypointGroup } from './types';

/**
 * Groups operational points along the computed path under the requested step
 * that precedes each one. Each group is a requested step followed by the
 * intermediate OPs that fall between it and the next requested step.
 *
 * A requested step may have no matching OP (for instance a map-click waypoint
 * that does not coincide with an operational point along the path). Such a
 * step keeps an undefined `requestedOp` and does not block the grouping of the
 * steps after it.
 */
export function groupOperationalPoints(
  operationalPoints: SuggestedOP[],
  pathSteps: PathStepV2[]
): WaypointGroup[] {
  const validSteps = pathSteps.filter(
    (step): step is PathStepV2 & { location: NonNullable<PathStepV2['location']> } =>
      step.location !== null
  );

  if (validSteps.length === 0) return [];

  const groups: WaypointGroup[] = validSteps.map((step) => ({
    requestedStep: step,
    requestedOp: undefined,
    intermediates: [],
  }));

  let currentGroupIndex = -1;

  operationalPoints.forEach((op) => {
    const matchedIndex = validSteps.findIndex(
      (step, index) => index > currentGroupIndex && matchPathStepAndOp(step.location, op)
    );

    if (matchedIndex !== -1) {
      currentGroupIndex = matchedIndex;
      groups[currentGroupIndex].requestedOp = op;
    } else if (currentGroupIndex >= 0) {
      groups[currentGroupIndex].intermediates.push(op);
    }
  });

  return groups;
}
