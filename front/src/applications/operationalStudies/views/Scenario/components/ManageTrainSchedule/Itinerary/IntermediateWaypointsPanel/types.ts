import type { PathWaypoint } from 'modules/simulationResult/types';
import type { PathStep } from 'reducers/osrdconf/types';
import type { NonNullableObject } from 'utils/types';

export type WaypointGroupOp = NonNullableObject<
  PathWaypoint,
  'opId' | 'country_code' | 'main_code'
>;

export type WaypointGroup = {
  requestedStep: PathStep;
  requestedOp: WaypointGroupOp | undefined;
  intermediates: WaypointGroupOp[];
  duplicatesCount: number;
};
