import { describe, it, expect } from 'vitest';

import { parseLocalDateTime, isArrivalDateInSearchTimeWindow } from 'utils/date';

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
