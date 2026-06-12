import { matchOpRefAndOp } from 'applications/operationalStudies/utils';
import type {
  CoreOperationalPointOnPath,
  OperationalPointReference,
} from 'common/api/osrdEditoastApi';
import type { PathStepV2 } from 'reducers/osrdconf/types';

import type { WaypointGroup } from './types';

type LocatedStep = PathStepV2 & { location: NonNullable<PathStepV2['location']> };

// Canonical key for an OP reference, so two references to the same OP compare equal.
const opRefKey = (ref: OperationalPointReference) => {
  switch (ref.type) {
    case 'id':
      return `id:${ref.operational_point}`;
    case 'uic':
      return `uic:${ref.uic}:${ref.secondary_code ?? ''}`;
    case 'trigram':
      return `trigram:${ref.trigram}:${ref.secondary_code ?? ''}`;
  }
};

// Whether two steps target the same OP. A pinned track only disambiguates which
// crossing is meant, so it is ignored here. Map-click (track_offset) waypoints
// are never collapsed: each click is its own point.
const isSameWaypoint = (a: LocatedStep, b: LocatedStep) => {
  if (a.location.type === 'track_offset' || b.location.type === 'track_offset') return false;
  return opRefKey(a.location.operational_point) === opRefKey(b.location.operational_point);
};

/**
 * Groups operational points along the computed path under the requested step
 * that precedes each one. Each group is a requested step followed by the
 * intermediate OPs that fall between it and the next requested step.
 *
 * A requested step may have no matching OP (for instance a map-click waypoint
 * that does not coincide with an operational point along the path). Such a
 * step keeps an undefined `requestedOp`, in which case, its entry in
 * `positionByStepId` is used to place the OPs that fall after it under it.
 *
 * Consecutive steps targeting the same OP (the same OP selected twice in a row)
 * are collapsed into a single group whose `count` reflects how many steps it
 * stands for.
 */
export function groupOperationalPoints(
  operationalPoints: CoreOperationalPointOnPath[],
  pathSteps: PathStepV2[],
  positionByStepId?: Map<string, number>
): WaypointGroup[] {
  const validSteps = pathSteps.filter((step): step is LocatedStep => step.location !== null);

  if (validSteps.length === 0) return [];

  // Collapse consecutive steps that target the same OP into one entry. Keep the
  // run's last step so new waypoints anchor after the whole run, not between its
  // duplicates.
  const collapsedSteps: { step: LocatedStep; duplicatesCount: number }[] = [];
  validSteps.forEach((step) => {
    const previous = collapsedSteps.at(-1);
    if (previous && isSameWaypoint(previous.step, step)) {
      previous.duplicatesCount += 1;
      previous.step = step;
    } else {
      collapsedSteps.push({ step, duplicatesCount: 1 });
    }
  });

  const groups: WaypointGroup[] = collapsedSteps.map(({ step, duplicatesCount }) => ({
    requestedStep: step,
    requestedOp: undefined,
    intermediates: [],
    duplicatesCount,
  }));

  const isStepBeforeOp = (step: LocatedStep, op: CoreOperationalPointOnPath) => {
    const position = positionByStepId?.get(step.id);
    return position !== undefined && position < op.position;
  };

  // Walk the OPs in path order, moving a cursor onto the latest requested step
  // each op has reached, then filing the op under that step's group.
  let currentGroupIndex = -1;
  operationalPoints.forEach((op) => {
    // Reach a step by position:
    while (
      currentGroupIndex + 1 < collapsedSteps.length &&
      isStepBeforeOp(collapsedSteps[currentGroupIndex + 1].step, op)
    ) {
      currentGroupIndex += 1;
    }

    // Reach a step by identity:
    const matchedIndex = collapsedSteps.findIndex(({ step }, index) => {
      if (index <= currentGroupIndex || !matchOpRefAndOp(step.location, op)) return false;
      // An OP crossed twice matches both steps by identity. Pick the right
      // crossing: by position if known, else by pinned track.
      const position = positionByStepId?.get(step.id);
      if (position !== undefined) return position === op.position;
      const pinnedTrack =
        step.location.type === 'operational_point_part_reference'
          ? step.location.local_track_name
          : undefined;
      return !pinnedTrack || pinnedTrack === op.part.local_track_name;
    });

    if (matchedIndex !== -1) {
      currentGroupIndex = matchedIndex;
      groups[currentGroupIndex].requestedOp = op;
    } else if (currentGroupIndex >= 0) {
      groups[currentGroupIndex].intermediates.push(op);
    }
  });

  return groups;
}
