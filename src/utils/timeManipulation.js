import * as d3 from 'd3';

export function datetime2string(ts) {
  const datetime = new Date(ts);
  return datetime.toLocaleString();
}

export function datetime2time(datetime) {
  const formatTime = d3.timeFormat('%H:%M:%S');
  return formatTime(datetime);
}

export function time2datetime(time) {
  return d3.timeParse('%H:%M:%S')(time);
}

export function sec2time(sec) {
  return new Date(sec * 1000).toISOString().substr(11, 8);
}

export function sec2datetime(sec) {
  return d3.timeParse('%H:%M:%S')(sec2time(sec));
}

export function time2sec(time) {
  const timeArray = time.split(':');
  const seconds = timeArray[2] ? Number(timeArray[2]) : 0;
  return (Number(timeArray[0]) * 3600) + (Number(timeArray[1]) * 60) + seconds;
}
