import type { PathWaypoint } from 'modules/simulationResult/types';
import type { PathStepV2 } from 'reducers/osrdconf/types';

export type WaypointGroup = {
  requestedStep: PathStepV2;
  requestedOp: PathWaypoint | undefined;
  intermediates: PathWaypoint[];
  duplicatesCount: number;
};
