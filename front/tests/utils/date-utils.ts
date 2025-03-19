import dayjs from 'dayjs';
// eslint-disable-next-line import/extensions
import timezone from 'dayjs/plugin/timezone.js';
// eslint-disable-next-line import/extensions
import utc from 'dayjs/plugin/utc.js';

dayjs.extend(utc);
dayjs.extend(timezone);

/**
 * Get a localized date string formatted according to the specified language.
 *
 * @param dateString - The date string to format (ISO format recommended)
 * @returns A formatted date string
 */
export function getLocalizedDateString(dateString: string): string {
  const projectLanguage = process.env.PROJECT_LANGUAGE;
  let locale: string;
  switch (projectLanguage) {
    case 'Français':
      locale = 'fr-FR';
      break;
    case 'English':
      locale = 'en-GB';
      break;
    default:
      throw new Error(`Unsupported project language: "${projectLanguage}".`);
  }
  const date = new Date(dateString);
  return new Intl.DateTimeFormat(locale, {
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
  const projectLanguage = process.env.PROJECT_LANGUAGE;
  let locale: string;
  switch (projectLanguage) {
    case 'Français':
      locale = 'fr-FR';
      break;
    case 'English':
      locale = 'en-GB';
      break;
    default:
      throw new Error(`Unsupported project language: "${projectLanguage}".`);
  }
  const date = new Date(dateString);
  const formattedDate = date.toLocaleDateString(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  return formattedDate.replace('.', '');
}
