import { describe, expect, it } from 'vitest';

import { type RangeDatePickerProps, type SingleDatePickerProps } from '../DatePicker';
import {
  isValidSlot,
  getDatesFromPreviousMonthInFirstWeek,
  getDatesFromNextMonthInLastWeek,
  getAllDatesInMonth,
  isSameDay,
  isWithinInterval,
  normalizeDate,
  formatDateString,
  computeNewSelectedSlot,
  formatSlotToInputValue,
  formatInputValue,
  formatValueToSlot,
} from '../utils';

const january = 0;
const february = 1;
const april = 3;
const may = 4;
const june = 5;
const july = 6;
const august = 7;
const september = 8;

const buildSingleDatePickerProps = (
  value: SingleDatePickerProps['value']
): SingleDatePickerProps => ({
  value: value,
  isRangeMode: false,
  onDateChange: () => {},
  inputProps: {
    id: 'date-picker',
  },
});

const buildRangeDatePickerProps = (value: RangeDatePickerProps['value']): RangeDatePickerProps => ({
  value,
  isRangeMode: true,
  onDateChange: () => {},
  inputProps: {
    id: 'date-picker',
  },
});

describe('isValidSlot', () => {
  it('should return true if start and end are not defined', () => {
    const slot = { start: null, end: null };
    expect(isValidSlot(slot)).toBe(true);
  });

  it('should return true if start is before end', () => {
    const slot = { start: new Date(2022, january, 1), end: new Date(2022, january, 2) };
    expect(isValidSlot(slot)).toBe(true);
  });

  it('should return true if start is the same as end', () => {
    const date = new Date(2022, january, 1);
    const slot = { start: date, end: date };
    expect(isValidSlot(slot)).toBe(true);
  });

  it('should return false if start is after end', () => {
    const slot = { start: new Date(2022, january, 2), end: new Date(2022, january, 1) };
    expect(isValidSlot(slot)).toBe(false);
  });
});

describe('getDatesFromPreviousMonthInFirstWeek', () => {
  it('should return an empty array if the first day of the month is a Monday', () => {
    // 1st April 2024 is a Monday
    const dates = getDatesFromPreviousMonthInFirstWeek(april, 2024);
    expect(dates).toEqual([]);
  });

  it('should return dates from the previous month if the first day of the month is not a Monday', () => {
    // 1st May 2024 is a Wednesday
    const dates = getDatesFromPreviousMonthInFirstWeek(may, 2024);
    expect(dates).toEqual([new Date(2024, april, 29), new Date(2024, april, 30)]);
  });

  it('should handle the case where the first day of the month is a Sunday', () => {
    // 1st September 2024 is a Sunday, so the function should return the dates of the last 6 days of August
    const dates = getDatesFromPreviousMonthInFirstWeek(september, 2024);
    expect(dates).toEqual([
      new Date(2024, august, 26),
      new Date(2024, august, 27),
      new Date(2024, august, 28),
      new Date(2024, august, 29),
      new Date(2024, august, 30),
      new Date(2024, august, 31),
    ]);
  });
});

describe('getDatesFromNextMonthInLastWeek', () => {
  it('should return an empty array if the last day of the month is a Sunday', () => {
    // June 2024 ends on a Sunday
    const dates = getDatesFromNextMonthInLastWeek(june, 2024);
    expect(dates).toEqual([]);
  });

  it('should return dates from the next month if the last day of the month is not a Sunday', () => {
    // April 2024 ends on a Tuesday
    const dates = getDatesFromNextMonthInLastWeek(april, 2024);
    expect(dates).toEqual([
      new Date(2024, may, 1),
      new Date(2024, may, 2),
      new Date(2024, may, 3),
      new Date(2024, may, 4),
      new Date(2024, may, 5),
    ]);
  });

  it('should handle the case where the last day of the month is a Saturday', () => {
    // August 2024 ends on a Saturday
    const dates = getDatesFromNextMonthInLastWeek(august, 2024);
    expect(dates).toEqual([new Date(2024, september, 1)]);
  });
});

describe('getAllDatesInMonth', () => {
  it('should return all dates in February 2024', () => {
    const dates = getAllDatesInMonth(february, 2024);
    const expectedDates = Array.from({ length: 29 }, (_, i) => new Date(2024, february, i + 1));
    expect(dates).toEqual(expectedDates);
  });

  it('should return all dates in April 2024', () => {
    const dates = getAllDatesInMonth(3, 2024);
    const expectedDates = Array.from({ length: 30 }, (_, i) => new Date(2024, april, i + 1));
    expect(dates).toEqual(expectedDates);
  });

  it('should return all dates in July 2024', () => {
    const dates = getAllDatesInMonth(july, 2024);
    const expectedDates = Array.from({ length: 31 }, (_, i) => new Date(2024, july, i + 1));
    expect(dates).toEqual(expectedDates);
  });
});

describe('isSameDay', () => {
  it('should return false if either date is null', () => {
    const date = new Date(2024, february, 1);
    expect(isSameDay(date, null)).toBe(false);
    expect(isSameDay(null, date)).toBe(false);
    expect(isSameDay(null, null)).toBe(false);
  });

  it('should return true if the dates are the same', () => {
    const date1 = new Date(2024, february, 1);
    const date2 = new Date(2024, february, 1);
    expect(isSameDay(date1, date2)).toBe(true);
  });

  it('should return false if the dates are different', () => {
    const date1 = new Date(2024, february, 1);
    const date2 = new Date(2024, february, 2);
    expect(isSameDay(date1, date2)).toBe(false);
  });
});

describe('isWithinInterval', () => {
  it('should return true if slot is undefined', () => {
    const date = new Date(2024, february, 1);
    expect(isWithinInterval(date)).toBe(true);
  });

  it('should return false if date is before slot start', () => {
    const date = new Date(2024, february, 1);
    const slot = { start: new Date(2024, february, 2), end: new Date(2024, february, 3) };
    expect(isWithinInterval(date, slot)).toBe(false);
  });

  it('should return false if date is after slot end', () => {
    const date = new Date(2024, february, 4);
    const slot = { start: new Date(2024, february, 2), end: new Date(2024, february, 3) };
    expect(isWithinInterval(date, slot)).toBe(false);
  });

  it('should return true if date is within slot', () => {
    const date = new Date(2024, february, 2, 12);
    const slot = { start: new Date(2024, february, 2, 13), end: new Date(2024, february, 3) };
    expect(isWithinInterval(date, slot)).toBe(true);
  });

  it('should return true if start is null', () => {
    const date = new Date(2024, february, 2);
    const slot = { start: null, end: new Date(2024, february, 3) };
    expect(isWithinInterval(date, slot)).toBe(true);
  });

  it('should return true if end is null', () => {
    const date = new Date(2024, february, 2);
    const slot = { start: new Date(2024, february, 1), end: null };
    expect(isWithinInterval(date, slot)).toBe(true);
  });

  it('should return true if start and end are null', () => {
    const date = new Date(2024, february, 2);
    const slot = { start: null, end: null };
    expect(isWithinInterval(date, slot)).toBe(true);
  });
});

describe('normalizeDate', () => {
  it('should normalize a date to midnight', () => {
    const inputDate = new Date(2023, april, 10, 15, 30, 45); // 10 Avril 2023, 15:30:45
    const expectedDate = new Date(2023, april, 10); // 10 Avril 2023, 00:00:00
    expect(normalizeDate(inputDate)).toEqual(expectedDate);
  });

  it('should keep the year, month, and day of the input date', () => {
    const inputDate = new Date(2023, april, 10);
    const normalizedDate = normalizeDate(inputDate);
    expect(normalizedDate.getFullYear()).toBe(2023);
    expect(normalizedDate.getMonth()).toBe(april);
    expect(normalizedDate.getDate()).toBe(10);
  });

  it('should reset hours, minutes, and seconds to zero', () => {
    const inputDate = new Date(2023, april, 10, 23, 59, 59);
    const normalizedDate = normalizeDate(inputDate);
    expect(normalizedDate.getHours()).toBe(0);
    expect(normalizedDate.getMinutes()).toBe(0);
    expect(normalizedDate.getSeconds()).toBe(0);
  });
});

describe('formatDateString', () => {
  it('should format a date as a string', () => {
    const date = new Date(2023, april, 10);
    expect(formatDateString(date)).toBe('10/04/23');
  });

  it('should format a date with a single digit day', () => {
    const date = new Date(2023, april, 1);
    expect(formatDateString(date)).toBe('01/04/23');
  });

  it('should format a date with a single digit month', () => {
    const date = new Date(2023, february, 10);
    expect(formatDateString(date)).toBe('10/02/23');
  });

  it('should format a date with a single digit day and month', () => {
    const date = new Date(2023, february, 1);
    expect(formatDateString(date)).toBe('01/02/23');
  });
});

describe('computeNewSelectedSlot', () => {
  it('Spec 1: Sets the clicked date as start date if no slot is selected', () => {
    const clickedDate = new Date('2023-04-01');
    const result = computeNewSelectedSlot(clickedDate, undefined);
    expect(result).toEqual({ start: clickedDate, end: null });
  });

  it('Spec 2: Clears the slot if the same end date is selected', () => {
    const clickedDate = new Date('2023-04-01');
    const prevSelectedSlot = { start: clickedDate, end: null };
    const result = computeNewSelectedSlot(clickedDate, prevSelectedSlot);
    expect(result).toBeUndefined();
  });

  it('Spec 3: Updates the start date if an earlier date is clicked', () => {
    const clickedDate = new Date('2023-03-31');
    const prevSelectedSlot = { start: new Date('2023-04-01'), end: null };
    const result = computeNewSelectedSlot(clickedDate, prevSelectedSlot);
    expect(result).toEqual({ start: clickedDate, end: new Date('2023-04-01') });
  });

  it('Spec 4: Sets the end date if a later date is clicked', () => {
    const clickedDate = new Date('2023-04-02');
    const prevSelectedSlot = { start: new Date('2023-04-01'), end: null };
    const result = computeNewSelectedSlot(clickedDate, prevSelectedSlot);
    expect(result).toEqual({ start: new Date('2023-04-01'), end: clickedDate });
  });

  it('Spec 5: Clears the existing slot and sets a new start date if a slot is already defined', () => {
    const clickedDate = new Date('2023-04-03');
    const prevSelectedSlot = { start: new Date('2023-04-01'), end: new Date('2023-04-02') };
    const result = computeNewSelectedSlot(clickedDate, prevSelectedSlot);
    expect(result).toEqual({ start: clickedDate, end: null });
  });
});

describe('formatSlotToInputValue', () => {
  it('Spec 0: If the slot is undefined, return an empty string', () => {
    const result = formatSlotToInputValue(undefined);
    expect(result).toBe('');
  });

  it('Spec 1: If the start and end dates are the same, return the formatted date of the start date', () => {
    const slot = { start: new Date('2023-04-01'), end: new Date('2023-04-01') };
    const result = formatSlotToInputValue(slot);
    expect(result).toBe('01/04/23');
  });

  it('Spec 2: If the start and end dates are in the same year, return the formatted start date without the year and end date', () => {
    const slot = { start: new Date('2023-04-01'), end: new Date('2023-04-15') };
    const result = formatSlotToInputValue(slot);
    expect(result).toBe('01/04 - 15/04/23');
  });

  it('Spec 3: If the start and end dates are in different years, return the formatted start date and end date with the year', () => {
    const slot = { start: new Date('2023-12-31'), end: new Date('2024-01-01') };
    const result = formatSlotToInputValue(slot);
    expect(result).toBe('31/12/23 - 01/01/24');
  });
});

describe('formatInputValue', () => {
  it('should format the value for range mode correctly', () => {
    const rangeValue = { start: new Date('2023-04-01'), end: new Date('2023-04-15') };
    const result = formatInputValue(buildRangeDatePickerProps(rangeValue));
    expect(result).toBe('01/04 - 15/04/23');
  });

  it('should format the value for single date mode correctly', () => {
    const result = formatInputValue(buildSingleDatePickerProps(new Date('2023-04-01')));
    expect(result).toBe('01/04/23');
  });
});

describe('formatValueToSlot', () => {
  it('should return the input as it is for range mode', () => {
    const rangeValue = { start: new Date('2023-04-01'), end: new Date('2023-04-15') };
    const result = formatValueToSlot(buildRangeDatePickerProps(rangeValue));
    expect(result).toEqual(rangeValue);
  });

  it('should return a slot with start and end being the same for single date mode when value is provided', () => {
    const singleValue = new Date('2023-04-01');
    const result = formatValueToSlot(buildSingleDatePickerProps(singleValue));
    expect(result).toEqual({ start: singleValue, end: singleValue });
  });

  it('should return a slot with start and end as null for single date mode when value is not provided', () => {
    const result = formatValueToSlot(buildSingleDatePickerProps(undefined));
    expect(result).toBeUndefined();
  });
});
