import * as d3 from 'd3';
import { TimeString } from 'common/types';

export function datetime2string(ts: string | number | Date) {
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
  return d3.timeParse('%H:%M:%S')(sec2time(sec)); // We conder it's utc to avoid +0 delta
}

export function time2sec(time: TimeString) {
  const timeString = String(time);
  const timeArray = timeString.split(':');
  const seconds = timeArray[2] ? Number(timeArray[2]) : 0;
  return Number(timeArray[0]) * 3600 + Number(timeArray[1]) * 60 + seconds;
}

export function datetime2sec(time: Date) {
  return time2sec(datetime2time(time));
}

export function durationInSeconds(start: number, end: number) {
  return end > start ? end - start : end + 86400 - start;
}
