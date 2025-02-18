import { describe, it, expect } from 'vitest';

import {
  parseLocalDateTime,
  isoDateToMs,
  serializeDateTimeWithoutYear,
  extractDateAndTime,
  isArrivalDateInSearchTimeWindow,
} from 'utils/date';

describe('parseLocalDateTime', () => {
  it('should return an iso date by passing a date without milliseconds', () => {
    const inputDate = '2024-04-25T08:20';
    const isoDate = parseLocalDateTime(inputDate);
    expect(isoDate?.toISOString()).toEqual('2024-04-25T08:20:00.000Z');
  });

  it('should return an iso date by passing a date with milliseconds', () => {
    const inputDate = '2024-04-25T08:20:10';
    const isoDate = parseLocalDateTime(inputDate);
    expect(isoDate?.toISOString()).toEqual('2024-04-25T08:20:10.000Z');
  });

  it('should return an iso date by passing a date with a space between date and time instead of a T', () => {
    const inputDate = '2024-04-25 08:20:10';
    const isoDate = parseLocalDateTime(inputDate);
    expect(isoDate?.toISOString()).toEqual('2024-04-25T08:20:10.000Z');
  });

  it('should return null by passing a date with the wrong format', () => {
    const inputDate = '04-25 08:20:10';
    const isoDate = parseLocalDateTime(inputDate);
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

describe('extractDateAndTime', () => {
  it('should correctly parse the date and time from an ISO string', () => {
    const arrivalTime = new Date('2024-10-05T14:30:00+00:00');
    const result = extractDateAndTime(arrivalTime);

    expect(result).toEqual({
      arrivalDate: '2024-10-05',
      arrivalTime: '14:30',
      arrivalTimehours: 14,
      arrivalTimeMinutes: 30,
    });
  });

  it('should handle single digit hours and minutes correctly', () => {
    const arrivalTime = new Date('2024-10-05T09:05:00+00:00');
    const result = extractDateAndTime(arrivalTime);

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
    const result = isArrivalDateInSearchTimeWindow(new Date('2024-08-01T10:00:00Z'), undefined);
    expect(result).toBe(true);
  });

  it('should return true if arrivalTime is within the searchDatetimeWindow', () => {
    const searchDatetimeWindow = {
      begin: new Date('2024-08-01T00:00:00Z'),
      end: new Date('2024-08-02T00:00:00Z'),
    };
    const result = isArrivalDateInSearchTimeWindow(
      new Date('2024-08-01T10:00:00Z'),
      searchDatetimeWindow
    );
    expect(result).toBe(true);
  });

  it('should return false if arrivalTime is outside the searchDatetimeWindow', () => {
    const searchDatetimeWindow = {
      begin: new Date('2024-08-01T00:00:00Z'),
      end: new Date('2024-08-02T00:00:00Z'),
    };
    const result = isArrivalDateInSearchTimeWindow(
      new Date('2024-07-30T23:59:59Z'),
      searchDatetimeWindow
    );
    expect(result).toBe(false);
  });
});
