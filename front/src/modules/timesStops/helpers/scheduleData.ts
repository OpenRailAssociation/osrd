import { ISO8601Duration2sec, datetime2sec, secToHoursString } from 'utils/timeManipulation';

import type { ComputedScheduleEntry, ScheduleEntry } from '../types';

/**
 *
 * @param schedule for a given operational point
 * @param startTime time of departure from the very beginning of the route
 */
export function computeScheduleData(schedule: ScheduleEntry, startTime: string) {
  if (!schedule) {
    return { arrival: null, departure: null, stopFor: null };
  }
  const startTimeSeconds = datetime2sec(new Date(startTime));
  // relative value, number of seconds since startTime
  const arrivalSeconds = schedule.arrival
    ? startTimeSeconds + ISO8601Duration2sec(schedule.arrival)
    : null;
  const stopForSeconds = schedule.stop_for ? ISO8601Duration2sec(schedule.stop_for) : null;
  const departure =
    arrivalSeconds && stopForSeconds ? startTimeSeconds + arrivalSeconds + stopForSeconds : null;
  return {
    arrival: arrivalSeconds,
    departure,
    stopFor: stopForSeconds,
  };
}

export function formatScheduleData(scheduleData: ComputedScheduleEntry) {
  return {
    arrival: scheduleData.arrival ? secToHoursString(scheduleData.arrival, true) : '',
    departure: scheduleData.departure ? secToHoursString(scheduleData.departure, true) : '',
    stopFor: scheduleData.stopFor ? String(scheduleData.stopFor) : '',
  };
}
