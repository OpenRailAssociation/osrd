/* eslint-disable import/prefer-default-export */
import { dateToHHMMSS } from 'utils/date';
import { Duration, addDurationToDate } from 'utils/duration';
import { ms2sec } from 'utils/timeManipulation';

import type { ScheduleEntry } from '../types';
import { receptionSignalToSignalBooleans } from './utils';

/** Format the stopFor, calculatedDeparture, shortSlipDistance and onStopSignal properties */
export const formatSchedule = (arrivalTime: Date, schedule?: ScheduleEntry) => {
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

  return {
    stopFor: `${ms2sec(stopFor.ms)}`,
    calculatedDeparture: dateToHHMMSS(addDurationToDate(arrivalTime, stopFor)),
    ...receptionSignalToSignalBooleans(schedule.reception_signal),
  };
};
