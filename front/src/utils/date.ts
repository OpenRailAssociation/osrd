import { useMemo } from 'react';

import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';

import type { StdcmSearchDatetimeWindow } from 'applications/stdcm/types';

dayjs.extend(customParseFormat);

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

export const useDateTimeLocale = () => {
  const { i18n } = useTranslation();

  return useMemo(() => {
    const dateTimeLocale = new Intl.DateTimeFormat().resolvedOptions().locale;
    return new Intl.Locale(dateTimeLocale, { language: i18n.language });
  }, [i18n.language]);
};
