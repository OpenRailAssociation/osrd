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
