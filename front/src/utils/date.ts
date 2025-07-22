import dayjs from 'dayjs';
import 'dayjs/locale/fr';
import 'dayjs/locale/de';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';
import type { TFunction } from 'i18next';

import type { StdcmSearchDatetimeWindow } from 'applications/stdcm/types';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(customParseFormat);

const userTimeZone = dayjs.tz.guess(); // Format : 'Europe/Paris'

export function dateTimeFormatting(date: Date, locale: string, withoutTime: boolean = false) {
  const dateFormat = withoutTime ? 'D MMM YYYY' : 'D MMM YYYY HH:mm';
  return dayjs(date).locale(locale).tz(userTimeZone).format(dateFormat).replace(/\./gi, '');
}

/**
 * Transform a date from a datetime-local input format to a JS Date
 * @param inputDate e.g. 2024-04-25T08:30
 * @return a date or null
 */
export const parseLocalDateTime = (inputDateTime: string) => {
  // Regex to check format 1234-56-78T12:00:00(:00)
  const inputDateTimeRegex = /^\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}(?::\d{2}){0,1}$/;
  if (inputDateTimeRegex.test(inputDateTime)) {
    const date = new Date(inputDateTime);
    return Number.isNaN(date.valueOf()) ? null : date;
  }
  return null;
};

/**
 * Format a local date suitable for an <input type="datetime-local">.
 */
export const formatLocalDateTime = (date: Date) =>
  dayjs(date).local().format('YYYY-MM-DDTHH:mm:ss');

/**
 * Format a local date suitable for an <input type="date">.
 */
export const formatLocalDate = (date: Date) => dayjs(date).local().format('YYYY-MM-DD');

/**
 * format Date into local time, suitable for an <input type="time">
 */
export const formatLocalTime = (date: Date) => dayjs(date).local().format('HH:mm:ss');

export function formatDay(dateString: string, locale: string = 'fr'): string {
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

/**
 * Checks if the given arrival date falls within the specified search time window.
 *
 * @param {Date} arrivalDate - The arrival time, which is a Date object.
 * @param {StdcmSearchDatetimeWindow | undefined} searchDatetimeWindow - An object containing the start and end dates of the search window. If undefined, the function will return true.
 * @returns {boolean} - Returns true if the arrival date is within the search time window, or if the search time window is undefined. Returns false otherwise.
 */
export function isArrivalDateInSearchTimeWindow(
  arrivalDate: Date,
  searchDatetimeWindow?: StdcmSearchDatetimeWindow
) {
  if (!searchDatetimeWindow) {
    return true;
  }
  return arrivalDate >= searchDatetimeWindow.begin && arrivalDate <= searchDatetimeWindow.end;
}

export const isEqualDate = (searchDate: Date, startDate: Date) =>
  searchDate.getFullYear() === startDate.getFullYear() &&
  searchDate.getMonth() === startDate.getMonth() &&
  searchDate.getDate() === startDate.getDate();

/**
 * @param start Date object
 * @param end Date object
 * @returns string "Xj Yh Zmin"
 */
export const formatTimeDifference = (_start: Date, _end: Date, t: TFunction): string => {
  const start = dayjs(_start);
  const end = dayjs(_end);

  const diffInDays = end.diff(start, 'day');
  const diffInHours = end.diff(start, 'hour') % 24;
  const diffInMinutes = end.diff(start, 'minute') % 60;

  const parts = [];
  if (diffInDays > 0) parts.push(`${diffInDays}${t('common.units.day')}`);
  if (diffInHours > 0) parts.push(`${diffInHours}${t('common.units.hour')}`);
  if (diffInMinutes > 0) parts.push(`${diffInMinutes}${t('common.units.minute')}`);

  return parts.join(' ');
};

export const dateToHHMMSS = (date: Date, options?: { withoutSeconds?: boolean; utc?: boolean }) => {
  const format = options?.withoutSeconds ? 'HH:mm' : 'HH:mm:ss';
  if (options?.utc) return dayjs(date).utc().format(format);
  return dayjs(date).local().format(format);
};
