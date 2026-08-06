import { useMemo } from 'react';

import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';

import type { StdcmSearchDatetimeWindow } from 'applications/stdcm/types';
import { Duration, type StartTime } from 'utils/duration';

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

const pad = (value: number) => String(value).padStart(2, '0');

/** Format a duration as an elapsed "hh:mm" or "hh:mm:ss" time. Hours are not wrapped at 24. */
const durationToElapsedString = (duration: Duration, withSeconds: boolean): string => {
  const hours = Math.floor(duration.total('hour'));
  const minutes = Math.floor(duration.sub(new Duration({ hours })).total('minute'));
  if (!withSeconds) return `${pad(hours)}:${pad(minutes)}`;

  const seconds = Math.floor(duration.sub(new Duration({ hours, minutes })).total('second'));
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
};

/** Format a start time as a clock time for a Date, or an elapsed "hh:mm:ss" for a Duration. */
export const timeToLocaleString = (time: StartTime, locale: Intl.Locale): string =>
  time instanceof Duration ? durationToElapsedString(time, true) : time.toLocaleTimeString(locale);

/**
 * Format a start time to a string rounded to the nearest minute: a locale-aware clock
 * time for a Date (calendar timetable), or an "H:mm" elapsed time for a Duration
 * (offset from the start of an hourly timetable, which has no locale/calendar meaning).
 */
export const timeToLocaleStringRounded = (time: StartTime, locale: Intl.Locale): string => {
  if (time instanceof Duration) {
    return durationToElapsedString(time.round('minute'), false);
  }
  const roundedTime = new Date(
    ...[
      time.getFullYear(),
      time.getMonth(),
      time.getDate(),
      time.getHours(),
      time.getMinutes() + (time.getSeconds() > 29 ? 1 : 0),
      time.getSeconds(),
    ]
  );
  return roundedTime.toLocaleTimeString(locale, { timeStyle: 'short' });
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
