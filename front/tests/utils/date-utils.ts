import dayjs from 'dayjs';
// eslint-disable-next-line import/extensions
import timezone from 'dayjs/plugin/timezone.js';
// eslint-disable-next-line import/extensions
import utc from 'dayjs/plugin/utc.js';

dayjs.extend(utc);
dayjs.extend(timezone);

export const DATE_OFFSET = {
  TODAY: 0,
  TOMORROW: 1,
};

/**
 * Get a localized date string formatted to French.
 *
 * @param dateString - The date string to format (ISO format recommended)
 * @returns A formatted date string
 */
export function getLocalizedDateString(dateString: string): string {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

/**
 * Create a Day.js object in a specific timezone.
 *
 * @param dateString - The date string in ISO format
 * @param timeZone - The timezone (e.g., "Europe/Paris")
 */
export const createDateInSpecialTimeZone = (dateString: string, timeZone: string) =>
  dayjs.tz(dateString, timeZone);

/**
 * Convert a date string from YYYY-MM-DD format to "DD mmm YYYY" format.
 * @param dateString - The input date string in YYYY-MM-DD format.
 * @returns The formatted date string in "DD mmm YYYY" format.
 */
export function formatDateToDayMonthYear(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Returns an ISO date string (YYYY-MM-DD) in a specific timezone.
 *
 * @param offsetDays - Number of days to add (0 = today, 1 = tomorrow)
 * @param timeZone - Target timezone (default: Europe/Paris)
 */
export function getISODate(offsetDays = DATE_OFFSET.TODAY, timeZone = 'Europe/Paris'): string {
  return dayjs().tz(timeZone).add(offsetDays, 'day').format('YYYY-MM-DD');
}

/**
 * Convert an "HH:mm:ss" string to a number of seconds.
 */
export function toSeconds(hms: string): number {
  const [hours, minutes, seconds] = hms.split(':').map(Number);
  return hours * 3600 + minutes * 60 + seconds;
}

/**
 * Add a number of seconds to an "HH:mm:ss" string, wrapping around 24h.
 */
export function addSecondsToHms(hms: string, deltaSeconds: number): string {
  const totalSeconds = toSeconds(hms) + deltaSeconds;
  const hours = Math.floor(totalSeconds / 3600) % 24;
  const minutes = Math.floor((totalSeconds % 3600) / 60) % 60;
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((value) => String(value).padStart(2, '0')).join(':');
}

/**
 * Parse a "HHhMMmSSs" duration display string into a number of seconds.
 */
export function parseDurationDisplay(display: string): number {
  const match = /^(\d\d)h(\d\d)m(\d\d)s$/.exec(display);
  if (!match) return 0;
  const [, hours, minutes, seconds] = match;
  return Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds);
}

/**
 * Returns today's date as a short date string (DD/MM/YY) in a specific timezone.
 *
 * @param timeZone - Target timezone (default: Europe/Paris)
 */
export function getTodayShortDate(timeZone = 'Europe/Paris'): string {
  return dayjs().tz(timeZone).format('DD/MM/YY');
}
