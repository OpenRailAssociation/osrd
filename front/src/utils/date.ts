import dayjs from 'dayjs';
import 'dayjs/locale/fr';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.locale('fr');
dayjs.extend(utc);
dayjs.extend(timezone);

export function formatIsoDate(date: Date) {
  return date.toISOString().substring(0, 10);
}

export function dateTimeFrenchFormatting(date: Date) {
  return dayjs.utc(date).tz(dayjs.tz.guess()).format('D MMM YYYY HH:mm').replace(/\./gi, '');
}
