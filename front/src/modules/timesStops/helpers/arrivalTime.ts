/* eslint-disable import/prefer-default-export */
import { SECONDS_IN_A_DAY, secToHoursString } from 'utils/timeManipulation';

import { ARRIVAL_TIME_ACCEPTABLE_ERROR_MS } from '../consts';
import type { ComputedScheduleEntry } from '../types';

/**
 * we have a theoretical arrival value the user requested
 * and there is a computed arrival value for the train from the simulation.
 *
 * if the two values are less than 1 second apart, we consider it’s a rounding error and we return the theoretical value.
 */
export function checkAndFormatCalculatedArrival(
  scheduleData: ComputedScheduleEntry,
  operationalPointTime: number
) {
  if (!scheduleData.arrival) {
    return secToHoursString(operationalPointTime, true);
  }
  const arrivalValuesAreClose =
    Math.abs(scheduleData.arrival - (operationalPointTime % SECONDS_IN_A_DAY)) <=
    ARRIVAL_TIME_ACCEPTABLE_ERROR_MS / 1000;
  const calculatedArrival = arrivalValuesAreClose ? scheduleData.arrival : operationalPointTime;

  return secToHoursString(calculatedArrival, true);
}
