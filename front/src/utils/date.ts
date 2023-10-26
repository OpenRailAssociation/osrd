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

/** check whether a date is included in the range or not */
export function dateIsInRange(date: Date, range: [Date, Date]) {
  return date > range[0] && date < range[1];
}

export const formatDateForInput = (date?: string | null) => (date ? date.substring(0, 10) : '');

export function getEarliestDate(date1: string | null | undefined, dat2: string | null | undefined) {
  const formatedDate1 = formatDateForInput(date1);
  const formatedDate2 = formatDateForInput(dat2);
  if (formatedDate1 && formatedDate2) {
    return formatedDate1 < formatedDate2 ? formatedDate1 : formatedDate2;
  }
  return formatedDate1 || formatedDate2;
}
