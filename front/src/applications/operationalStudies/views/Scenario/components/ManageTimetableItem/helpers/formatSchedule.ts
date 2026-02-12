import { compact } from 'lodash';

import type { PacedTrain } from 'common/api/osrdEditoastApi';
import type { PathStep } from 'reducers/osrdconf/types';

const formatSchedule = (pathSteps: PathStep[]): PacedTrain['schedule'] => {
  const schedules = pathSteps.map((step) => {
    if (step?.arrival || step.stopFor) {
      return {
        at: step.id,
        arrival: step.arrival?.toISOString() ?? undefined,
        reception_signal: step.receptionSignal,
        stop_for: step.stopFor?.toISOString() ?? undefined,
      };
    }
    return undefined;
  });
  return compact(schedules);
};

export default formatSchedule;
