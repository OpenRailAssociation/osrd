import * as d3 from 'd3';

import type { TimeString } from 'common/types';

export function sec2ms(sec: number) {
  return sec * 1000;
}

export function ms2sec(ms: number) {
  return ms / 1000;
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

export function formatToISO8601(dateTimeStr: string) {
  const date = new Date(dateTimeStr);

  // Get the timezone offset in minutes and convert it to hh:mm format
  const offset = date.getTimezoneOffset();
  const offsetHours = Math.abs(Math.floor(offset / 60));
  const offsetMinutes = Math.abs(offset % 60);
  const timezoneFormatted = `${offset > 0 ? '-' : '+'}${offsetHours.toString().padStart(2, '0')}:${offsetMinutes.toString().padStart(2, '0')}`;

  // Format the date to ISO string without 'Z' (UTC) and add the timezone
  return `${date.toISOString().replace('Z', '')}${timezoneFormatted}`;
}

export function calculateTimeDifferenceInSeconds(time1: string, time2: string) {
  const date1 = new Date(time1);
  const date2 = new Date(time2);
  return (date2.getTime() - date1.getTime()) / 1000;
}

export function formatDurationAsISO8601(seconds: number) {
  return `PT${Math.abs(seconds)}S`;
}

/**
 * Parse ISO8601 duration, for instance "PT11H9M8S" (11h, 9min and 8s) to seconds
 */
export function ISO8601Duration2sec(duration: string) {
  const regex = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/;
  const matches = duration.match(regex);
  if (!matches) {
    throw new Error('Invalid ISO 8601 duration format');
  }

  const [hours, minutes, seconds] = matches.slice(1).map((match) => parseInt(match || '0', 10));
  return hours * 60 * 60 + minutes * 60 + seconds;
}

export function getStopTime(sec: number) {
  return new Date(sec * 1000).toISOString().substr(11, 5);
}

export function getStopDurationTime(sec: number) {
  const timeInMilliseconds = sec * 1000;
  const time = new Date(timeInMilliseconds);

  if (timeInMilliseconds < 60000) {
    return `${time.getUTCSeconds()} sec`;
  }
  return `${time.getUTCMinutes()} min`;
}
