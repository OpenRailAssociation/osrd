export function datetime2string(ts) {
  const datetime = new Date(ts);
  return datetime.toLocaleString();
}
