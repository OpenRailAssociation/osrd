import { compact, isNaN, isNil } from 'lodash';

import type { TrainScheduleBase } from 'common/api/osrdEditoastApi';
import type { PathStep } from 'reducers/osrdconf/types';
import {
  datetime2sec,
  durationInSeconds,
  formatDurationAsISO8601,
  time2sec,
} from 'utils/timeManipulation';

const formatSchedule = (
  pathSteps: PathStep[],
  startTime: string
): TrainScheduleBase['schedule'] => {
  const schedules = pathSteps.map((step) => {
    let formatArrival;
    if (step.arrival || step.stopFor) {
      if (step.arrival) {
        // Duration in seconds between startTime and step.arrival
        const durationStartTimeArrival = durationInSeconds(
          datetime2sec(new Date(startTime)),
          time2sec(step.arrival)
        );

        // Format duration in ISO8601
        formatArrival = formatDurationAsISO8601(durationStartTimeArrival);
      }

      return {
        at: step.id,
        arrival: formatArrival ?? undefined,
        locked: step.locked,
        on_stop_signal: step.onStopSignal,
        stop_for:
          isNil(step.stopFor) || isNaN(Number(step.stopFor))
            ? undefined
            : formatDurationAsISO8601(Number(step.stopFor)),
      };
    }
    return undefined;
  });
  return compact(schedules);
};

export default formatSchedule;
