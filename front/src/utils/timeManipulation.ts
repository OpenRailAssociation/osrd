import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration';
import utc from 'dayjs/plugin/utc';

import type { TimeString } from 'common/types';

dayjs.extend(duration);
dayjs.extend(utc);

export const SECONDS_IN_A_DAY = 86400;

export function ms2sec(ms: number) {
  return ms / 1000;
}

/**
 * Given a timeString, returns the number of seconds from midnight
 *
 * /!\ be carreful: this only handle time and not dates. Thus, it
 * can not be used to compare dates.
 */
export function time2sec(timeString: TimeString) {
  const timeArray = timeString.split(':');
  const seconds = timeArray[2] ? Number(timeArray[2]) : 0;
  return Number(timeArray[0]) * 3600 + Number(timeArray[1]) * 60 + seconds;
}

export function durationInSeconds(start: number, end: number) {
  return end > start ? end - start : end + SECONDS_IN_A_DAY - start;
}

export function calculateTimeDifferenceInDays(datetime1?: Date, datetime2?: Date) {
  if (!datetime1 || !datetime2) {
    return undefined;
  }
  const date1 = new Date(datetime1.getFullYear(), datetime1.getMonth(), datetime1.getDate());
  const date2 = new Date(datetime2.getFullYear(), datetime2.getMonth(), datetime2.getDate());
  return dayjs.duration(date2.getTime() - date1.getTime()).asDays();
}

/**
 * converts a value in seconds to a time string "HH:MM:SS"
 */
export function secToHoursString(sec: number): TimeString {
  const date = new Date(sec * 1000);
  return dayjs(date).utc().format('HH:mm:ss');
}
