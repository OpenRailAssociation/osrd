import { Duration, addDurationToDate } from 'utils/duration';

import type { ScheduleEntry } from '../types';
import { receptionSignalToSignalBooleans } from './utils';

/** Format the stopFor, calculatedDeparture, shortSlipDistance and onStopSignal properties */
export const formatSchedule = (
  arrivalTime: Date | undefined,
  schedule: ScheduleEntry | undefined
) => {
  if (!schedule) {
    return {
      stopFor: undefined,
      calculatedDeparture: undefined,
      shortSlipDistance: false,
      onStopSignal: false,
    };
  }

  if (!schedule.stop_for) {
    return {
      stopFor: undefined,
      calculatedDeparture: undefined,
      ...receptionSignalToSignalBooleans(schedule.reception_signal),
    };
  }

  const stopFor = Duration.parse(schedule.stop_for);

  if (!arrivalTime) {
    return {
      stopFor,
      calculatedDeparture: undefined,
      ...receptionSignalToSignalBooleans(schedule.reception_signal),
    };
  }
  return {
    stopFor,
    calculatedDeparture: addDurationToDate(arrivalTime, stopFor),
    ...receptionSignalToSignalBooleans(schedule.reception_signal),
  };
};
