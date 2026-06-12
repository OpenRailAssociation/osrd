import type { CoreOperationalPointOnPath } from 'common/api/osrdEditoastApi';
import type { PathStepV2 } from 'reducers/osrdconf/types';

export type WaypointGroup = {
  requestedStep: PathStepV2;
  requestedOp: CoreOperationalPointOnPath | undefined;
  intermediates: CoreOperationalPointOnPath[];
  duplicatesCount: number;
};
