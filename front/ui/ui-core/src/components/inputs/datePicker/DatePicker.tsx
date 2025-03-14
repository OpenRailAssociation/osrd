import React from 'react';

import { Calendar as CalendarIcon } from '@osrd-project/ui-icons';
import cx from 'classnames';

import { type CalendarSlot } from '.';
import CalendarPicker, { type CalendarPickerPublicProps } from './CalendarPicker';
import useDatePicker from './useDatePicker';
import InputModal from '../../Modal';
import Input, { type InputProps } from '../Input';

type BaseDatePickerProps = {
  selectableSlot?: CalendarSlot;
  inputProps: InputProps;
  calendarPickerProps?: CalendarPickerPublicProps;
  errorMessages?: { invalidInput?: string; invalidDate?: string };
  width?: number;
};

export type SingleDatePickerProps = BaseDatePickerProps & {
  isRangeMode?: false;
  onDateChange: (nextDate: Date) => void;
  value?: Date;
};

export type RangeDatePickerProps = BaseDatePickerProps & {
  isRangeMode: true;
  onDateChange: (clickedDate: Date, nextSelectedSlot?: CalendarSlot) => void;
  value?: CalendarSlot;
};

export type DatePickerProps = SingleDatePickerProps | RangeDatePickerProps;

export const DatePicker = (props: DatePickerProps) => {
  const {
    inputValue,
    statusWithMessage,
    selectedSlot,
    showPicker,
    modalPosition,
    inputRef,
    calendarPickerRef,
    setShowPicker,
    handleDayClick,
    handleInputClick,
    handleInputOnChange,
  } = useDatePicker(props);

  const { inputFieldWrapperClassname, ...otherInputProps } = props.inputProps;
  const { selectableSlot } = props;

  return (
    <div className="date-picker">
      <div>
        <Input
          {...otherInputProps}
          ref={inputRef}
          value={inputValue}
          onClick={handleInputClick}
          type="text"
          trailingContent={{
            content: <CalendarIcon />,
            onClickCallback: () => setShowPicker(!showPicker),
          }}
          inputFieldWrapperClassname={cx('date-picker-input', inputFieldWrapperClassname, {
            'range-mode': props.isRangeMode,
          })}
          autoComplete="off"
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleInputOnChange(e.target.value)}
          statusWithMessage={statusWithMessage}
        />
      </div>
      <InputModal inputRef={inputRef} isOpen={showPicker} onClose={() => setShowPicker(false)}>
        <div className="calendar-picker-wrapper">
          <CalendarPicker
            {...props.calendarPickerProps}
            selectedSlot={selectedSlot}
            onDayClick={handleDayClick}
            modalPosition={modalPosition}
            calendarPickerRef={calendarPickerRef}
            selectableSlot={selectableSlot}
          />
        </div>
      </InputModal>
    </div>
  );
};

export default DatePicker;
