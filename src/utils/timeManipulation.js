export function datetime2string(ts) {
  const datetime = new Date(ts);
  return datetime.toLocaleString();
}

export function sec2time(sec) {
  return new Date(sec * 1000).toISOString().substr(11, 8);
}

export function time2sec(time) {
  const timeArray = time.split(':');
  const seconds = timeArray[2] ? Number(timeArray[2]) : 0;
  return (Number(timeArray[0]) * 3600) + (Number(timeArray[1]) * 60) + seconds;
}
