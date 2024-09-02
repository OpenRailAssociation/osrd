import { describe, it } from 'vitest';

import {
  dateTimeToIso,
  isoDateToMs,
  formatToIsoDate,
  serializeDateTimeWithoutYear,
  parseDateTime,
  extractDateAndTimefromISO,
  isArrivalDateInSearchTimeWindow,
  formatLocaleDateToIsoDate,
  generateISODateFromDateTime,
} from 'utils/date';

describe('dateTimeToIso', () => {
  it('should return an iso date by passing a date without milliseconds', () => {
    const inputDate = '2024-04-25T08:20';
    const isoDate = dateTimeToIso(inputDate);
    expect(isoDate).toEqual('2024-04-25T08:20:00Z'); // Ends by Z because CI seems to be in UTC timezone
  });

  it('should return an iso date by passing a date with milliseconds', () => {
    const inputDate = '2024-04-25T08:20:10';
    const isoDate = dateTimeToIso(inputDate);
    expect(isoDate).toEqual('2024-04-25T08:20:10Z'); // Ends by Z because CI seems to be in UTC timezone
  });

  it('should return an iso date by passing a date with a space between date and time instead of a T', () => {
    const inputDate = '2024-04-25 08:20:10';
    const isoDate = dateTimeToIso(inputDate);
    expect(isoDate).toEqual('2024-04-25T08:20:10Z'); // Ends by Z because CI seems to be in UTC timezone
  });

  it('should return null by passing a date with the wrong format', () => {
    const inputDate = '04-25 08:20:10';
    const isoDate = dateTimeToIso(inputDate);
    expect(isoDate).toBeNull();
  });
});

describe('isoDateToMs', () => {
  it('should return the date in milliseconds', () => {
    const isoDate = '2024-04-26T20:30:15+02:00';
    const msDate = isoDateToMs(isoDate);
    expect(msDate).toEqual(1714156215000);
  });
});

describe('formatToIsoDate', () => {
  it('should return the date in ISO 8601', () => {
    const msDate = 1714156215000;
    const isoDate = formatToIsoDate(msDate);
    expect(isoDate).toEqual('2024-04-26T18:30:15Z'); // Ends by Z because CI seems to be in UTC timezone
  });
});

describe('parseDateTime', () => {
  it('should parse a valid date-time string', () => {
    const input = '18/07/2024 03:16:30';
    const result = parseDateTime(input);
    expect(result).toBeInstanceOf(Date);
  });

  it('should parse a valid date-time string with a single-digit day', () => {
    const input = '1/07/2024 03:16:30';
    const result = parseDateTime(input);
    expect(result).toBeInstanceOf(Date);
  });

  it('should return null for an invalid date-time string', () => {
    const input = 'invalid date';
    const result = parseDateTime(input);
    expect(result).toBeNull();
  });
});

describe('serializeDateTimeWithoutYear', () => {
  it('should return the date without the year for a valid Date object', () => {
    const inputDate = new Date('2024-07-18T03:16:30Z');
    const result = serializeDateTimeWithoutYear(inputDate);
    expect(result).toEqual('18/07 03:16:30');
  });

  it('should return an empty string for an invalid Date object', () => {
    const inputDate = new Date(NaN);
    const result = serializeDateTimeWithoutYear(inputDate);
    expect(result).toEqual('Invalid Date');
  });
});

describe('extractDateAndTimefromISO', () => {
  it('should correctly parse the date and time from an ISO string', () => {
    const arrivalTime = '2024-10-05T14:30:00+00:00';
    const result = extractDateAndTimefromISO(arrivalTime);

    expect(result).toEqual({
      arrivalDate: '2024-10-05',
      arrivalTime: '14:30',
      arrivalTimehours: 14,
      arrivalTimeMinutes: 30,
    });
  });

  it('should handle single digit hours and minutes correctly', () => {
    const arrivalTime = '2024-10-05T09:05:00+00:00';
    const result = extractDateAndTimefromISO(arrivalTime);

    expect(result).toEqual({
      arrivalDate: '2024-10-05',
      arrivalTime: '09:05',
      arrivalTimehours: 9,
      arrivalTimeMinutes: 5,
    });
  });
});

describe('isArrivalDateInSearchTimeWindow', () => {
  it('should return true if searchDatetimeWindow is undefined', () => {
    const result = isArrivalDateInSearchTimeWindow('2024-08-01T10:00:00Z', undefined);
    expect(result).toBe(true);
  });

  it('should return true if arrivalTime is within the searchDatetimeWindow', () => {
    const searchDatetimeWindow = {
      begin: new Date('2024-08-01T00:00:00Z'),
      end: new Date('2024-08-02T00:00:00Z'),
    };
    const result = isArrivalDateInSearchTimeWindow('2024-08-01T10:00:00Z', searchDatetimeWindow);
    expect(result).toBe(true);
  });

  it('should return false if arrivalTime is outside the searchDatetimeWindow', () => {
    const searchDatetimeWindow = {
      begin: new Date('2024-08-01T00:00:00Z'),
      end: new Date('2024-08-02T00:00:00Z'),
    };
    const result = isArrivalDateInSearchTimeWindow('2024-07-30T23:59:59Z', searchDatetimeWindow);
    expect(result).toBe(false);
  });
});

describe('generateISODateFromDateTime', () => {
  it('should correctly set hours and minutes and return ISO string', () => {
    const schedule = {
      date: new Date('2024-08-01T00:00:00Z'),
      hours: 10,
      minutes: 30,
    };
    const expectedISODate = formatLocaleDateToIsoDate(new Date('2024-08-01T10:30:00Z'));

    const result = generateISODateFromDateTime(schedule);

    expect(result).toBe(expectedISODate);
  });
});
