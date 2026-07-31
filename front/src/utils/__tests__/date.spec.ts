import { describe, it, expect } from 'vitest';

import {
  parseLocalDateTime,
  isArrivalDateInSearchTimeWindow,
  timeToLocaleStringRounded,
  timeToMsSinceMidnight,
} from 'utils/date';
import { Duration } from 'utils/duration';

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

  it('should return an iso date by passing a date with a two digits year', () => {
    const inputDate = '0024-04-25T08:20:10';
    const isoDate = parseLocalDateTime(inputDate);
    expect(isoDate?.toISOString()).toEqual('0024-04-25T08:20:10.000Z');
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

describe('timeToLocaleStringRounded', () => {
  const locale = new Intl.Locale('en-US');

  it('should format a Duration as an elapsed H:mm time, independent of locale', () => {
    expect(timeToLocaleStringRounded(new Duration({ hours: 8, minutes: 37 }), locale)).toEqual(
      '08:37'
    );
  });

  it('should round a Duration up to the nearest minute', () => {
    expect(
      timeToLocaleStringRounded(new Duration({ hours: 8, minutes: 37, seconds: 30 }), locale)
    ).toEqual('08:38');
  });

  it('should not wrap a Duration exceeding 24 hours', () => {
    expect(timeToLocaleStringRounded(new Duration({ hours: 25, minutes: 7 }), locale)).toEqual(
      '25:07'
    );
  });
});

describe('timeToMsSinceMidnight', () => {
  it('should convert hours and minutes to milliseconds since midnight', () => {
    const result = timeToMsSinceMidnight({ hours: 8, minutes: 30 });
    expect(result).toBe((8 * 60 + 30) * 60 * 1000);
  });

  it('should return 0 for midnight', () => {
    const result = timeToMsSinceMidnight({ hours: 0, minutes: 0 });
    expect(result).toBe(0);
  });
});
