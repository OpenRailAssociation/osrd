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

export function dateTimeFormatting(dateInput: Date | string, withoutTime = false): string {
  switch (i18n.language) {
    case 'fr':
      dayjs.locale('fr');
      break;
    default:
      dayjs.locale('en-gb');
  }
  let normalizedDateInput: string;

  // Convert date input to an ISO string if it is a Date object
  if (dateInput instanceof Date) {
    normalizedDateInput = dateInput.toISOString();
  } else if (typeof dateInput === 'string') {
    normalizedDateInput = dateInput; // Use the input directly if it is a string
  } else {
    throw new Error('dateInput must be a string or a Date object');
  }

  // Normalize the date string to ensure it ends with 'Z' for UTC time
  if (normalizedDateInput.endsWith('+00:00')) {
    normalizedDateInput = `${normalizedDateInput.slice(0, -6)}Z`;
  } else if (!normalizedDateInput.endsWith('Z')) {
    normalizedDateInput += 'Z';
  }

  // Create a dayjs object using the normalized UTC string
  const dayjsDate = dayjs(normalizedDateInput, { utc: true });

  const format = withoutTime ? 'D MMM YYYY' : 'D MMM YYYY HH:mm';
  // Convert the UTC date to local time and format it
  const formattedDate = dayjsDate.local().format(format);

  return formattedDate;
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
export const formatToIsoDate = (date: number | string, formatDate: boolean = false) => {
  const userTimeZone = dayjs.tz.guess(); // Format : 'Europe/Paris'
  const format = formatDate ? 'D/MM/YYYY HH:mm:ss' : '';
  return dayjs.tz(date, userTimeZone).format(format);
};

/**
 * Transform a date format ISO 8601 to a milliseconds date (elapsed from January 1st 1970)
 */
export const isoDateToMs = (isoDate: string) => {
  const isoCurrentDate = new Date(isoDate);
  return isoCurrentDate.getTime();
};

/**
 * Transform a date format ISO 8601 to seconds (elapsed from January 1st 1970, with timezone difference)
 */
export const isoDateWithTimezoneToSec = (isoDate: string) => {
  const timeDifferenceMinutes = new Date().getTimezoneOffset();
  return isoDateToMs(isoDate) / 1000 + Math.abs(timeDifferenceMinutes) * 60;
};

// TODO: This function is only used for V1, so it must be deleted when V1 is abandoned. Also we must rename formatDayV2.
export function formatDay(locale = 'fr') {
  if (!['en', 'fr'].includes(locale)) {
    throw new Error('Invalid locale');
  }
  dayjs.locale(locale);
  const currentDate = dayjs();
  if (locale === 'en') {
    return currentDate.format('dddd, MMMM D, YYYY');
  }
  return currentDate.format('dddd D MMMM YYYY');
}

export function formatDayV2(dateString: string, locale: string = 'fr'): string {
  if (!['en', 'fr'].includes(locale)) {
    throw new Error('Invalid locale');
  }
  const date = dayjs.utc(dateString).locale(locale);
  if (locale === 'en') {
    return date.format('dddd, MMMM D, YYYY');
  }
  return date.format('dddd D MMMM YYYY');
}

export const formatDateToString = (date: Date) => {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  return {
    day,
    month,
    year,
    hours,
    minutes,
  };
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

/**
 * Converts an UTC date in seconds since 1970 to a local date in seconds since 1970
 */
export function convertUTCDateToLocalDate(date: number) {
  const timeDifferenceMinutes = new Date().getTimezoneOffset();
  return Math.abs(timeDifferenceMinutes) * 60 + date;
}
