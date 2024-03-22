import dayjs from 'dayjs';
import 'dayjs/locale/fr';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';

import i18n from 'i18n';

dayjs.locale('fr');
dayjs.extend(utc);
dayjs.extend(timezone);

export function timestampToHHMMSS(timestamp: number) {
  const date = new Date(timestamp * 1000);
  return date.toISOString().substring(11, 19);
}

export function formatIsoDate(date: Date) {
  return date.toISOString().substring(0, 10);
}

export function dateTimeFormatting(date: Date, withoutTime: boolean = false) {
  switch (i18n.language) {
    case 'fr':
      dayjs.locale('fr');
      break;
    default:
      dayjs.locale('en-gb');
  }
  const dateFormat = withoutTime ? 'D MMM YYYY' : 'D MMM YYYY HH:mm';
  return dayjs.utc(date).tz(dayjs.tz.guess()).format(dateFormat).replace(/\./gi, '');
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
