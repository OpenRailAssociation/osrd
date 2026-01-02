import { type DatePickerProps, type CalendarSlot } from './index';

export const INVALID_SELECTED_SLOT_ERROR =
  'Invalid selectedSlot: If start and end are defined, the start date must be before the end date.';
export const INVALID_SELECTABLE_SLOT_ERROR =
  'Invalid selectableSlot: If start and end are defined, the start date must be before the end date.';
export const INVALID_SELECTED_SLOT_BASED_ON_SELECTABLE_SLOT_ERROR =
  'selectedSlot must be within selectableSlot';
export const INVALID_INITIAL_DATE_ERROR = 'initialDate must be within selectableSlot';

export const containsOnlyNumbersAndSlashes = (s: string) => /^[0-9/]+$/.test(s);

/**
 * Normalize the given date to midnight
 * @param date The date to normalize
 * @returns The normalized date
 */
export function normalizeDate(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/**
 * Check if the given slot is valid
 * @param slot The slot to check
 * @returns True if the slot is valid, false otherwise
 */
export function isValidSlot(slot: CalendarSlot) {
  if (slot.start && slot.end) {
    return normalizeDate(slot.start).getTime() <= normalizeDate(slot.end).getTime();
  }
  return true;
}

/**
 *  Get the dates from the previous month that are in the first week of the current month
 * @param month The month of the current date
 * @param fullYear The year of the current date
 * @returns   An array of dates from the previous month that are in the first week of the current month
 */
export function getDatesFromPreviousMonthInFirstWeek(month: number, fullYear: number): Date[] {
  const firstDayOfMonth = new Date(fullYear, month, 1);
  const firstDayOfWeek = firstDayOfMonth.getDay();

  // if the first day of the week is Monday, we don't need to return any dates from the previous month
  if (firstDayOfWeek === 1) {
    return [];
  }

  const daysFromPrevMonth = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;
  const lastDayPrevMonth = new Date(fullYear, month, 0);

  const dates: Date[] = [];
  for (let i = 0; i < daysFromPrevMonth; i++) {
    const day = lastDayPrevMonth.getDate() - i;
    dates.unshift(new Date(lastDayPrevMonth.getFullYear(), lastDayPrevMonth.getMonth(), day));
  }

  return dates;
}

/**
 *  Get the dates from the next month that are in the last week of the current month
 * @param month The month of the current date
 * @param fullYear The year of the current date
 * @returns  An array of dates from the next month that are in the last week of the current month
 */
export function getDatesFromNextMonthInLastWeek(month: number, fullYear: number) {
  const lastDayOfMonth = new Date(fullYear, month + 1, 0);
  const lastDayOfWeek = lastDayOfMonth.getDay();
  const daysFromNextMonth = (7 - lastDayOfWeek) % 7;

  if (daysFromNextMonth === 0) {
    return [];
  }

  const nextMonth = new Date(fullYear, month + 1, 1);

  const dates: Date[] = [];
  for (let i = 0; i < daysFromNextMonth; i++) {
    const day = i + 1;
    dates.push(new Date(nextMonth.getFullYear(), nextMonth.getMonth(), day));
  }

  return dates;
}

/**
 * Get all the dates in the month of the given date
 * @param month The month of the current date
 * @param fullYear The year of the current date
 * @returns An array of all the dates in the month of the given date
 */
export function getAllDatesInMonth(month: number, fullYear: number) {
  const lastDayOfMonth = new Date(fullYear, month + 1, 0);
  const totalDaysInMonth = lastDayOfMonth.getDate();

  const dates: Date[] = [];
  for (let day = 1; day <= totalDaysInMonth; day++) {
    dates.push(new Date(fullYear, month, day));
  }

  return dates;
}

/**
 * Check if the given dates are the same day
 * @param date1 The first date
 * @param date2 The second date
 * @returns True if the dates are the same day, false otherwise
 */
export function isSameDay(date1: Date | null, date2: Date | null) {
  if (!date1 || !date2) {
    return false;
  }

  return (
    date1.getDate() === date2.getDate() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getFullYear() === date2.getFullYear()
  );
}

/**
 * Check if the given date is within the given slot
 * if the slot is not provided, the date is considered to be within the slot
 * if a boundary of the slot is not provided, it's considered to be an open boundary
 * @param date The date to check
 * @param slot The slot to check
 * @returns True if the date is within the slot, false otherwise
 */
export function isWithinInterval(date: Date, slot?: CalendarSlot) {
  if (!slot) return true;

  const normalizedDate = normalizeDate(date);
  const normalizedStart = slot.start ? normalizeDate(slot.start) : undefined;
  const normalizedEnd = slot.end ? normalizeDate(slot.end) : undefined;

  const isAfterStart = normalizedStart ? normalizedDate >= normalizedStart : true;
  const isBeforeEnd = normalizedEnd ? normalizedDate <= normalizedEnd : true;

  return isAfterStart && isBeforeEnd;
}

/**
 * Generates a list of dates, each representing the start of a month,
 * starting from a given date and continuing for a specified number of months.
 * This function correctly handles year rollover.
 * @param startDate - The date from which to start generating month start dates.
 * @param monthsCount - The number of month start dates to generate.
 * @returns An array of Dates, each set to the first day of consecutive months starting from startDate.
 */
export function generateSequentialDates(startDate: Date, monthsCount: number) {
  const dates = [];
  for (let i = 0; i < monthsCount; i++) {
    const date = new Date(startDate);
    date.setMonth(startDate.getMonth() + i, 1);
    dates.push(new Date(date.getFullYear(), date.getMonth(), 1));
  }
  return dates;
}
/**
 * Format the given date as a string in the format 'dd/mm/yy'.
 * @param date The date to format
 * @returns The formatted date string
 */
export function formatDateString(date?: Date | null) {
  if (!date) return '';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = String(date.getFullYear()).slice(-2);
  return `${day}/${month}/${year}`;
}

/**
 * Handles the logic for when a day is clicked on the calendar.
 *
 * @param clickedDate - The date that was clicked.
 * @param isRangeMode - Whether the calendar is in range mode.
 * @param prevSelectedSlot - The previously selected slot.
 * Spec 1: If the user clicks on a single date, that date is set as the start date of the slot.
 * Spec 2: If the user selects the same end date as the start date, clear the slot
 * Spec 3: If the user clicks on a date that is before the currently selected start date, the new date becomes the start date and the previous start date becomes the end date.
 * Spec 4: If the user clicks on a date that is after the currently selected start date, that date becomes the end date of the slot.
 * Spec 5: If a slot is already defined (i.e., both start and end dates are defined) and the user clicks on a new date, the existing slot is cleared and the new date becomes the start date of the new slot.
 */
export function computeNewSelectedSlot(
  clickedDate: Date,
  prevSelectedSlot: CalendarSlot | undefined
): CalendarSlot | undefined {
  if (!prevSelectedSlot || prevSelectedSlot?.start === null) {
    // Spec 1

    return { start: clickedDate, end: null };
  } else if (!prevSelectedSlot.end) {
    if (normalizeDate(clickedDate).getTime() === normalizeDate(prevSelectedSlot.start).getTime()) {
      // Spec 2
      return undefined;
    } else if (normalizeDate(clickedDate) < normalizeDate(prevSelectedSlot.start)) {
      // Spec 3
      return { start: clickedDate, end: prevSelectedSlot.start };
    } else {
      // Spec 4
      return { start: prevSelectedSlot.start, end: clickedDate };
    }
  } else {
    // Spec 5
    return { start: clickedDate, end: null };
  }
}

/**
 * Format the selected slot to a string that can be displayed in the input field.
 * @param slot The new selected slot
 * @returns The formatted string
 * Spec 0: If the slot is undefined, return an empty string.
 * Spec 1: If the start and end dates are the same, return the formatted date of the start date.
 * Spec 2: If the start and end dates are in the same year, return the formatted start date without the year and end date.
 * Spec 3: If the start and end dates are in different years, return the formatted start date and end date with the year.
 */
export function formatSlotToInputValue(slot: CalendarSlot | undefined) {
  let formattedDate = '';
  if (slot) {
    const { start, end } = slot;

    if (isSameDay(start, end)) {
      formattedDate = formatDateString(start);
    } else {
      let formattedStartDate = formatDateString(start);

      if (start && end && start.getFullYear() === end.getFullYear()) {
        formattedStartDate = formattedStartDate.slice(0, 5);
      }

      formattedDate = `${formattedStartDate} - ${formatDateString(end)}`;
    }
  }
  return formattedDate;
}

/**
 * Format the new value to a string that can be displayed in the input field.
 * @param value The new value
 * @param isRangeMode Whether the calendar is in range mode
 * @returns The formatted string
 */
export function formatInputValue({ value, isRangeMode }: DatePickerProps) {
  if (isRangeMode) {
    return formatSlotToInputValue(value);
  }
  return formatDateString(value);
}

export function formatValueToSlot({ value, isRangeMode }: DatePickerProps) {
  if (isRangeMode) {
    return value;
  }

  return value ? { start: value, end: value } : value;
}

/**
 * Validates the selected and selectable slots as well as the initial date.
 * @param selectedSlot The selected slot to validate.
 * @param selectableSlot The selectable slot to validate.
 * @param date The date to validate.
 *
 * Three main validation checks are performed:
 * - Check if the selected and selectable slots are valid.
 * - Ensures the selected slot is within the selectable slot.
 * - Ensures the initial date is within the selectable slot
 */
export function validateSlots(
  selectedSlot: CalendarSlot | undefined,
  selectableSlot: CalendarSlot | undefined,
  date: Date | undefined
) {
  if (selectedSlot && !isValidSlot(selectedSlot)) {
    throw new Error(INVALID_SELECTED_SLOT_ERROR);
  }

  if (selectableSlot && !isValidSlot(selectableSlot)) {
    throw new Error(INVALID_SELECTABLE_SLOT_ERROR);
  }

  if (
    selectedSlot?.start &&
    selectedSlot?.end &&
    selectableSlot?.start &&
    selectableSlot?.end &&
    (normalizeDate(selectedSlot.start) < normalizeDate(selectableSlot.start) ||
      normalizeDate(selectedSlot.end) > normalizeDate(selectableSlot.end))
  ) {
    throw new Error(INVALID_SELECTED_SLOT_BASED_ON_SELECTABLE_SLOT_ERROR);
  }

  if (
    date &&
    selectableSlot?.start &&
    selectableSlot?.end &&
    (normalizeDate(date) < normalizeDate(selectableSlot.start) ||
      normalizeDate(date) > normalizeDate(selectableSlot.end))
  ) {
    throw new Error(INVALID_INITIAL_DATE_ERROR);
  }
}
