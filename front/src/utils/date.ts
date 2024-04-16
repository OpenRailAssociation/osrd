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
  const dateToUTC = dayjs(`${date}Z`); // The 'Z' is to ensure we have an UTC date
  const dateFormat = withoutTime ? 'D MMM YYYY' : 'D MMM YYYY HH:mm';
  return dateToUTC.tz(dayjs.tz.guess()).format(dateFormat).replace(/\./gi, '');
}

/**
 * Transform a date from a datetime-local input format to an
 * ISO 8601 date with the user timezone
 * @param inputDate e.g. 2024-04-25T08:30
 * @return an ISO 8601 date (e.g. 2024-04-25T08:30:00+02:00) or null
 */
export const dateTimeToIso = (inputDateTime: string) => {
  // Regex to check format 1234-56-78T12:00:00(:00)
  const inputDateTimeRegex = /^\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}(?::\d{2}){0,1}$/;
  if (inputDateTimeRegex.test(inputDateTime)) {
    const userTimeZone = dayjs.tz.guess(); // Format : 'Europe/Paris'
    return dayjs.tz(inputDateTime, userTimeZone).format();
  }
  return null;
};

/**
 * Transform a milliseconds date to an ISO 8601 date with the user timezone
 * @param msDate milliseconds date (elapsed from January 1st 1970)
 * @return an ISO 8601 date (e.g. 2024-04-25T08:30:00+02:00)
 */
export const msToIsoDate = (msDate: number) => {
  const userTimeZone = dayjs.tz.guess(); // Format : 'Europe/Paris'
  return dayjs.tz(msDate, userTimeZone).format();
};

/**
 * Transform a date format ISO 8601 to a milliseconds date (elapsed from January 1st 1970)
 */
export const isoDateToMs = (isoDate: string) => {
  const isoCurrentDate = new Date(isoDate);
  return isoCurrentDate.getTime();
};

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
