import * as d3 from 'd3';

import type { TimeString } from 'common/types';

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
  return d3.timeParse('%H:%M:%S')(sec2time(sec)) as Date; // We conder it's utc to avoid +0 delta
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
  return end > start ? end - start : end + 86400 - start;
}
