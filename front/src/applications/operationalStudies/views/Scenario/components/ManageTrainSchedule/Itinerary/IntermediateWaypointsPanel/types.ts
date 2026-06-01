import type { SuggestedOP } from 'modules/trainSchedule/types';
import type { PathStepV2 } from 'reducers/osrdconf/types';

export type WaypointGroup = {
  requestedStep: PathStepV2;
  requestedOp: SuggestedOP | undefined;
  intermediates: SuggestedOP[];
};
