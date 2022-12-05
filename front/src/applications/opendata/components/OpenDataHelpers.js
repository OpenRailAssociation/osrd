export function seconds2hhmmss(seconds) {
  const dateTime = new Date(seconds * 1000);
  return dateTime.toJSON().substring(11, 19);
}
