import cx from 'classnames';

import { type CalendarProps } from './Calendar';
import {
  getAllDatesInMonth,
  getDatesFromNextMonthInLastWeek,
  getDatesFromPreviousMonthInFirstWeek,
  isSameDay,
  isWithinInterval,
  normalizeDate,
} from './utils';

export default function useCalendar({
  displayedMonthStartDate,
  selectableSlot,
  selectedSlot,
}: CalendarProps) {
  const referenceDate = selectableSlot?.start ?? new Date();
  referenceDate.setHours(0, 0, 0, 0);
  const displayedYear = displayedMonthStartDate.getFullYear();
  const displayedMonth = displayedMonthStartDate.getMonth();
  const daysInMonth = getAllDatesInMonth(displayedMonth, displayedYear);
  const daysInLastMonth = getDatesFromPreviousMonthInFirstWeek(displayedMonth, displayedYear);
  const daysInNextMonth = getDatesFromNextMonthInLastWeek(displayedMonth, displayedYear);
  const allDays = [...daysInLastMonth, ...daysInMonth, ...daysInNextMonth];

  const buildDayWrapperClassName = (date: Date) => {
    const isStart = (selectedSlot && isSameDay(date, selectedSlot.start)) || false;
    const isEnd = (selectedSlot && isSameDay(date, selectedSlot.end)) || false;
    const withinSelectedSlot =
      (selectedSlot?.start && selectedSlot.end && isWithinInterval(date, selectedSlot)) ||
      isStart ||
      isEnd;
    const insideSelectableSlot = isWithinInterval(date, selectableSlot);

    let classNames = {
      'inside-selectable-slot': insideSelectableSlot,
      'outside-selectable-slot': !insideSelectableSlot,
      'current-month': date.getMonth() === displayedMonth,
      past: normalizeDate(date) < normalizeDate(referenceDate),
    } as Record<string, boolean | null>;

    if (selectedSlot) {
      classNames = {
        ...classNames,
        start: isStart,
        end: isEnd,
        'within-selected-slot': withinSelectedSlot,
      };
    }

    return cx('day-wrapper', classNames);
  };

  const isDateSelectable = (date: Date) => {
    // Check if the date is within the selectable interval
    if (!isWithinInterval(date, selectableSlot)) return false;

    // Check if the date is in the currently displayed month
    if (date.getMonth() !== displayedMonth) return false;

    return true;
  };

  return {
    days: allDays,
    isReferenceDate: (date: Date) =>
      normalizeDate(date).getTime() === normalizeDate(referenceDate).getTime(),
    buildDayWrapperClassName,
    isDateSelectable,
  };
}
