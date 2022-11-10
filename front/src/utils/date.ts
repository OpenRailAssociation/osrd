// eslint-disable-next-line import/prefer-default-export
export function formatIsoDate(date: Date) {
  return date.toISOString().substring(0, 10);
}
