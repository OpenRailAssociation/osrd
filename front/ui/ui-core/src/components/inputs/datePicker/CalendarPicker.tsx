import React from 'react';

import { ChevronLeft, ChevronRight } from '@osrd-project/ui-icons';
import cx from 'classnames';

import Calendar from './Calendar';
import { type CalendarSlot } from './type';
import useCalendarPicker from './useCalendarPicker';

export type CalendarPickerPrivateProps = {
  selectedSlot?: CalendarSlot;
  onDayClick: (day: Date) => void;
  modalPosition: {
    top: number;
    left: number;
  };
  calendarPickerRef: React.RefObject<HTMLDivElement>;
  selectableSlot?: CalendarSlot;
};

export type CalendarPickerPublicProps = {
  initialDate?: Date;
  numberOfMonths?: 1 | 2 | 3;
};

export type CalendarPickerProps = CalendarPickerPrivateProps & CalendarPickerPublicProps;

const CalendarPicker = ({
  initialDate,
  selectedSlot,
  selectableSlot,
  numberOfMonths = 1,
  onDayClick,
  modalPosition,
  calendarPickerRef,
}: CalendarPickerProps) => {
  const {
    displayedMonthsStartDates,
    showNavigationBtn,
    canGoToNextMonth,
    canGoToPreviousMonth,
    handleGoToNextMonth,
    handleGoToPreviousMonth,
  } = useCalendarPicker({
    initialDate,
    selectedSlot,
    selectableSlot,
    numberOfMonths,
  });

  return (
    <div ref={calendarPickerRef} className="calendar-picker" style={modalPosition}>
      {showNavigationBtn && (
        <span
          className={cx('calendar-navigation-btn', 'previous', {
            disabled: !canGoToPreviousMonth,
          })}
          onClick={handleGoToPreviousMonth}
        >
          <ChevronLeft size="lg" />
        </span>
      )}
      <div className={cx('calendar-list', { 'navigation-btn-hidden': !showNavigationBtn })}>
        {displayedMonthsStartDates.map((date) => (
          <Calendar
            key={date.getTime()}
            displayedMonthStartDate={date}
            selectableSlot={selectableSlot}
            selectedSlot={selectedSlot}
            onDayClick={onDayClick}
          />
        ))}
      </div>
      {showNavigationBtn && (
        <span
          className={cx('calendar-navigation-btn', 'next', {
            disabled: !canGoToNextMonth,
          })}
          onClick={handleGoToNextMonth}
        >
          <ChevronRight size="lg" />
        </span>
      )}
    </div>
  );
};

export default CalendarPicker;
