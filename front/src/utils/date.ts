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

/** Format a start time as a clock time for a Date, or an elapsed "hh:mm:ss" for a Duration. */
export const timeToLocaleString = (time: StartTime, locale: Intl.Locale): string =>
  time instanceof Duration
    ? time.toLocaleString(locale, {
        style: 'digital',
        hours: '2-digit',
      })
    : time.toLocaleTimeString(locale);

/**
 * Converts a time-of-day (hours/minutes, no date) into the equivalent offset in
 * milliseconds since midnight.
 * @param hours - The hour (0-23).
 * @param minutes - The minute (0-59).
 * @returns The equivalent time in milliseconds since midnight.
 */
export const timeToMsSinceMidnight = ({
  hours,
  minutes,
}: {
  hours: number;
  minutes: number;
}): number => (hours * 60 + minutes) * 60 * 1000;

/**
 * Format a start time to a string rounded to the nearest minute: a locale-aware clock
 * time for a Date (calendar timetable), or an "H:mm" elapsed time for a Duration
 * (offset from the start of an hourly timetable, which has no locale/calendar meaning).
 */
export const timeToLocaleStringRounded = (time: StartTime, locale: Intl.Locale): string => {
  if (time instanceof Duration) {
    return time
      .round('minute')
      .toLocaleString(locale, { style: 'digital', hours: '2-digit', secondsDisplay: 'auto' });
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
