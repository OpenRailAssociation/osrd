export function datetime2string(ts) {
  const datetime = new Date(ts);
  return datetime.toLocaleString();
}

export function sec2time(sec) {
  return new Date(sec * 1000).toISOString().substr(11, 8);
}
