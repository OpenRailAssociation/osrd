import dayjs from 'dayjs';
import 'dayjs/locale/fr';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';

import i18n from 'i18n';

import { ISO8601Duration2sec } from './timeManipulation';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(customParseFormat);

/**
 * @param dateTimeString date string in ISO format
 * @returns string "HH:MM:SS"
 */
export function extractHHMMSS(dateTimeString?: string) {
  if (!dateTimeString) {
    return '';
  }
  return dateTimeString.substring(11, 19);
}

/**
 * @param dateTimeString date string in ISO format
 * @returns string "HH:MM"
 */
export function extractHHMM(dateTimeString?: string) {
  if (!dateTimeString) {
    return '';
  }
  return dateTimeString.substring(11, 16);
}

export function timestampToHHMMSS(timestamp: number) {
  const date = new Date(timestamp * 1000);
  return extractHHMMSS(date.toISOString());
}

export function formatIsoDate(date: Date) {
  return date.toISOString().substring(0, 10);
}

export function dateTimeFormatting(
  date: Date,
  withoutTime: boolean = false,
  isUTC: boolean = true
) {
  let locale;
  switch (i18n.language) {
    case 'fr':
      locale = 'fr';
      break;
    default:
      locale = 'en';
  }
  // Force interpreting the date in UTC
  const dateToUTC = dayjs(date).utc(isUTC);
  const dateFormat = withoutTime ? 'D MMM YYYY' : 'D MMM YYYY HH:mm';
  const tz = dayjs.tz.guess();
  return dateToUTC.locale(locale).tz(tz).format(dateFormat).replace(/\./gi, '');
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
 * Transform a locale date to an ISO 8601 date
 * @param date Date we want to transform to ISO 8601
 * @return an ISO 8601 date (e.g. 2024-04-25T08:30:00+02:00)
 */
export const formatLocaleDateToIsoDate = (date: Date) => dayjs.tz(date).format();

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
  const currentDate = dayjs().locale(locale);
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

export const formatDateToString = (date: Date, shortYear: boolean = false) => {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const shortYearFormat = String(year).slice(-2);
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  return {
    day,
    month,
    year: shortYear ? shortYearFormat : year,
    hours,
    minutes,
  };
};

/** check whether a date is included in the range or not */
export function dateIsInRange(date: Date, range: [Date, Date]) {
  return range[0] <= date && date <= range[1];
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

export function convertIsoUtcToLocalTime(isoUtcString: string): string {
  return dayjs(isoUtcString).local().format();
}

export function addDurationToIsoDate(startTime: string, duration: string) {
  return dayjs(startTime).add(ISO8601Duration2sec(duration), 'second').format();
}

/**
 * Parses a date string in 'DD/MM/YYYY HH:mm:ss' format to a Date object.
 * @param {string} dateTime - The date-time string to be parsed.
 * @returns {Date | null} The parsed Date object, or null if the input is invalid.
 */
export function parseDateTime(dateTime: string): Date | null {
  const date = dayjs(dateTime, ['DD/MM/YYYY HH:mm:ss', 'D/MM/YYYY HH:mm:ss']);
  if (!date.isValid()) return null;
  return date.toDate();
}

/**
 * Serializes a Date object to a string format 'DD/MM HH:mm:ss' without the year.
 * @param {Date} date - The Date object to be serialized.
 * @returns {string} The formatted date-time string without the year.
 */
export function serializeDateTimeWithoutYear(date: Date): string {
  const dayjsDate = dayjs(date);
  return dayjsDate.format('DD/MM HH:mm:ss');
}

/**
 * Convert an ISO date into a string formatted as 'DD/MM/YYYY' and extract the numeric values for hours and minutes.
 * @param {string} arrivalTime - Arrival time at which the train should arrive at the location. (Format: 'YYYY-MM-DDTHH:mm:ss+HH:mm')
 * @returns {object} An object containing the parsed date and time.
 */
export function extractDateAndTimefromISO(arrivalTime: string) {
  const dayjsDate = dayjs(arrivalTime);
  return {
    arrivalDate: dayjsDate.format('YYYY-MM-DD'), // ISO date part
    arrivalTime: dayjsDate.format('HH:mm'), // ISO time part
    arrivalTimehours: dayjsDate.hour(),
    arrivalTimeMinutes: dayjsDate.minute(),
  };
}

/**
 * Checks if the given arrival date falls within the specified search time window.
 *
 * @param {string} arrivalTime - The arrival time as a string, which will be parsed into a Date object.
 * @param {{ begin: Date; end: Date } | undefined} searchDatetimeWindow - An object containing the start and end dates of the search window. If undefined, the function will return true.
 * @returns {boolean} - Returns true if the arrival date is within the search time window, or if the search time window is undefined. Returns false otherwise.
 */
export function isArrivalDateInSearchTimeWindow(
  arrivalTime: string,
  searchDatetimeWindow?: { begin: Date; end: Date }
) {
  if (!searchDatetimeWindow) {
    return true;
  }
  const arrivalDate = new Date(arrivalTime);
  return arrivalDate >= searchDatetimeWindow.begin && arrivalDate <= searchDatetimeWindow.end;
}
