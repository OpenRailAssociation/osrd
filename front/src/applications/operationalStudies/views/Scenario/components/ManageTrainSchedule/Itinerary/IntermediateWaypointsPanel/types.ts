import type { CoreOperationalPointOnPath } from 'common/api/osrdEditoastApi';
import type { PathStep } from 'reducers/osrdconf/types';

export type WaypointGroup = {
  requestedStep: PathStep;
  requestedOp: CoreOperationalPointOnPath | undefined;
  intermediates: CoreOperationalPointOnPath[];
  duplicatesCount: number;
};
