import React from 'react';

import { type CalendarSlot } from './type';
import useCalendar from './useCalendar';

const WEEKDAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export type CalendarProps = {
  selectedSlot?: CalendarSlot;
  selectableSlot?: CalendarSlot;
  displayedMonthStartDate: Date;
  onDayClick: (date: Date) => void;
};

type DayProps = {
  date: Date;
  isSelectable: boolean;
  isReferenceDate: boolean;
  dayWrapperClassName: string;
  onClick: (date: Date) => void;
};

const Day = ({ date, isReferenceDate, isSelectable, dayWrapperClassName, onClick }: DayProps) => (
  <div
    onClick={() => {
      if (isSelectable) onClick(date);
    }}
    className="day-background"
  >
    <div className={dayWrapperClassName}>
      <span className="day">{date.getDate()}</span>
      {isReferenceDate && <span className="current-date-highlight" />}
    </div>
  </div>
);

const Calendar = (props: CalendarProps) => {
  const { days, isReferenceDate, isDateSelectable, buildDayWrapperClassName } = useCalendar(props);
  const { displayedMonthStartDate, onDayClick } = props;
  return (
    <div className="calendar-wrapper">
      <div className="calendar-anatomy">
        <p className="calendar-month-label">
          {displayedMonthStartDate.toLocaleString('en-GB', { month: 'short' })}
        </p>
        <div className="calendar-grid-wrapper">
          <div className="calendar-weekday-labels">
            {WEEKDAY_LABELS.map((label, index) => (
              <p key={`${label}-${index}`}>{label}</p>
            ))}
          </div>
          <div className="calendar-days-grid">
            {days.map((date) => (
              <Day
                key={date.getTime()}
                date={date}
                isReferenceDate={isReferenceDate(date)}
                isSelectable={isDateSelectable(date)}
                dayWrapperClassName={buildDayWrapperClassName(date)}
                onClick={onDayClick}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Calendar;
