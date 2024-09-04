import type { IsoDurationString } from 'common/types';
import type { SuggestedOP } from 'modules/trainschedule/components/ManageTrainSchedule/types';
import { ISO8601Duration2sec, formatDurationAsISO8601 } from 'utils/timeManipulation';

import type { ComputedScheduleEntry, ScheduleEntry } from '../types';

/**
 *
 * @param schedule for a given operational point
 */
export function computeScheduleData(schedule: ScheduleEntry) {
  if (!schedule) {
    return { arrival: null, departure: null, stopFor: null };
  }
  const arrivalSeconds = schedule.arrival ? ISO8601Duration2sec(schedule.arrival) : null;
  const stopForSeconds = schedule.stop_for ? ISO8601Duration2sec(schedule.stop_for) : null;
  const departureSeconds =
    arrivalSeconds && stopForSeconds ? arrivalSeconds + stopForSeconds : null;

  return {
    arrival: arrivalSeconds,
    departure: departureSeconds,
    stopFor: stopForSeconds,
  };
}

export function formatScheduleData(
  scheduleData: ComputedScheduleEntry
): Pick<SuggestedOP, 'arrival' | 'departure' | 'stopFor'> {
  const arrival: IsoDurationString | null = scheduleData.arrival
    ? formatDurationAsISO8601(scheduleData.arrival)
    : null;
  const departure: IsoDurationString | null = scheduleData.departure
    ? formatDurationAsISO8601(scheduleData.departure)
    : null;
  const stopFor = scheduleData.stopFor !== null ? String(scheduleData.stopFor) : '';
  return {
    arrival,
    departure,
    stopFor,
  };
}
