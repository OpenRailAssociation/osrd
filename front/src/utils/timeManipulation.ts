import * as d3 from 'd3';
import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration';

import type { TimeString } from 'common/types';

dayjs.extend(duration);

export const SECONDS_IN_A_DAY = 86400;

export function sec2ms(sec: number) {
  return sec * 1000;
}

export function ms2sec(ms: number) {
  return ms / 1000;
}

export function minToMs(min: number) {
  return min * 60 * 1000;
}

export function datetime2string(ts: string | number | Date): TimeString {
  const datetime = new Date(ts);
  return datetime.toLocaleString();
}

export function datetime2time(datetime: Date) {
  const formatTime = d3.timeFormat('%H:%M:%S');
  return formatTime(datetime);
}

export function time2datetime(time: TimeString) {
  return d3.timeParse('%H:%M:%S')(time);
}

export function sec2time(sec: number) {
  return new Date(sec * 1000).toISOString().substr(11, 8);
}

export function sec2datetime(sec: number) {
  return d3.timeParse('%H:%M:%S')(sec2time(sec))!; // We consider it's utc to avoid +0 delta
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

export function datetime2sec(time: Date): number {
  return time2sec(datetime2time(time));
}

export function durationInSeconds(start: number, end: number) {
  return end > start ? end - start : end + SECONDS_IN_A_DAY - start;
}

export function calculateTimeDifferenceInSeconds(time1: string | Date, time2: string | Date) {
  const date1 = new Date(time1);
  const date2 = new Date(time2);
  return (date2.getTime() - date1.getTime()) / 1000;
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
 * converts a value in seconds to a timeString "HH:MM"
 *
 * using the param withSeconds returns the longer format "HH:MM:SS"
 */
export function secToHoursString(sec: number | null, { withSeconds = false } = {}): TimeString {
  if (!sec) {
    return '';
  }
  const format = withSeconds ? '%H:%M:%S' : '%H:%M';
  return d3.utcFormat(format)(new Date(sec * 1000));
}

export function secToMin(sec: number) {
  return sec / 60;
}
