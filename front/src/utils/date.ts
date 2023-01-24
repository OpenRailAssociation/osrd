import dayjs from 'dayjs';

export function formatIsoDate(date: Date) {
  return date.toISOString().substring(0, 10);
}

export function dateTimeFrenchFormatting(date: Date) {
  return dayjs(date).format('D MMM YYYY HH:mm').replace(/\./gi, '');
}
