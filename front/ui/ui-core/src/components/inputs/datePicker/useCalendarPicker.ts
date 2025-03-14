import { useEffect, useState } from 'react';

import { type CalendarPickerProps } from './CalendarPicker';
import { generateSequentialDates, validateSlots } from './utils';

export default function useCalendarPicker({
  initialDate,
  selectedSlot,
  selectableSlot,
  numberOfMonths = 1,
}: Omit<CalendarPickerProps, 'modalPosition' | 'calendarPickerRef' | 'onDayClick'>) {
  validateSlots(selectedSlot, selectableSlot, initialDate);

  const [activeDate, setActiveDate] = useState(new Date());

  const displayedMonthsStartDates = generateSequentialDates(activeDate, numberOfMonths);

  const activeYear = activeDate.getFullYear();
  const activeMonth = activeDate.getMonth();
  const firstDayOfMonth = new Date(activeYear, activeMonth, 1);
  const lastDayOfMonth = new Date(activeYear, activeMonth + 1, 0);

  const canGoToPreviousMonth =
    selectableSlot === undefined || selectableSlot.start === null
      ? true
      : selectableSlot.start < firstDayOfMonth;

  const canGoToNextMonth =
    selectableSlot === undefined || selectableSlot.end === null
      ? true
      : selectableSlot.end > lastDayOfMonth;

  const showNavigationBtn = canGoToPreviousMonth || canGoToNextMonth;

  const handleGoToPreviousMonth = () => {
    if (canGoToPreviousMonth) {
      const previousActiveMonth = activeMonth === 0 ? 11 : activeMonth - 1;
      const previousActiveYear = activeMonth === 0 ? activeYear - 1 : activeYear;
      setActiveDate(new Date(previousActiveYear, previousActiveMonth, 1));
    }
  };

  const handleGoToNextMonth = () => {
    if (canGoToNextMonth) {
      const nextActiveMonth = activeMonth === 11 ? 0 : activeMonth + 1;
      const nextActiveYear = activeMonth === 11 ? activeYear + 1 : activeYear;
      setActiveDate(new Date(nextActiveYear, nextActiveMonth, 1));
    }
  };

  useEffect(() => {
    setActiveDate(initialDate ?? selectedSlot?.start ?? selectableSlot?.start ?? new Date());
  }, [initialDate, selectedSlot, selectableSlot]);

  return {
    displayedMonthsStartDates,
    showNavigationBtn,
    canGoToPreviousMonth,
    canGoToNextMonth,
    handleGoToPreviousMonth,
    handleGoToNextMonth,
  };
}
