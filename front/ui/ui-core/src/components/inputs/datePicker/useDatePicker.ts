import { useState, useRef, useEffect } from 'react';

import type { DatePickerProps } from './DatePicker';
import {
  computeNewSelectedSlot,
  containsOnlyNumbersAndSlashes,
  formatInputValue,
  formatValueToSlot,
  isWithinInterval,
} from './utils';
import { useModalPosition } from '../../../hooks/useModalPosition';
import useOutsideClick from '../../../hooks/useOutsideClick';
import type { StatusWithMessage } from '../StatusMessage';

const MODAL_VERTICAL_OFFSET = 3;

// Regex for "xx/xx/xx"
const SINGLE_DATE_REGEX = /^\d{2}\/\d{2}\/\d{2}$/;

export default function useDatePicker(datePickerProps: DatePickerProps) {
  const { value, isRangeMode, selectableSlot, errorMessages, onDateChange } = datePickerProps;
  const [showPicker, setShowPicker] = useState(false);
  const [inputValue, setInputValue] = useState(formatInputValue(datePickerProps));
  const [selectedSlot, setSelectedSlot] = useState(formatValueToSlot(datePickerProps));
  const [statusWithMessage, setStatusWithMessage] = useState<StatusWithMessage>();
  const calendarPickerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useOutsideClick(calendarPickerRef, (e) => {
    // Do not close the picker if any children in input wrapper is clicked.
    // This wrapper include, the input itself, the trailing content (which contains the calendar icon) and the leading content
    if (
      inputRef.current &&
      inputRef.current.parentElement?.parentElement?.contains(e.target as Node)
    )
      return;
    setShowPicker(false);
  });
  const { calculatePosition, modalPosition } = useModalPosition(
    inputRef,
    calendarPickerRef,
    MODAL_VERTICAL_OFFSET
  );

  const handleInputClick = () => {
    if (isRangeMode) {
      setShowPicker(true);
    }
  };

  const handleDayClick = (clickedDate: Date) => {
    if (isRangeMode) {
      const newSelectedSlot = computeNewSelectedSlot(clickedDate, value);
      onDateChange(clickedDate, newSelectedSlot);
    } else {
      onDateChange(clickedDate);
    }
  };

  const handleInputOnChange = (newValue: string) => {
    if (isRangeMode) {
      return;
    }

    setInputValue(newValue);
    const inputIsDate = SINGLE_DATE_REGEX.test(newValue);

    if (inputIsDate) {
      const [day, month, year] = newValue.split('/').map(Number);
      const date = new Date(year + 2000, month - 1, day);
      const isRealDate = !Number.isNaN(date.getTime());
      const isValid = isRealDate && isWithinInterval(date, selectableSlot);
      if (isValid) {
        setStatusWithMessage(undefined);
        onDateChange(date);
      } else {
        setStatusWithMessage({ status: 'error', message: errorMessages?.invalidDate });
        onDateChange(undefined);
      }
      return;
    }

    if (containsOnlyNumbersAndSlashes(newValue) && newValue.length < 8) {
      setStatusWithMessage(undefined);
      onDateChange(undefined);
      return;
    }
    onDateChange(undefined);
    setStatusWithMessage({
      status: 'error',
      message: errorMessages?.invalidInput,
    });
  };

  useEffect(() => {
    if (showPicker) calculatePosition();
  }, [showPicker, calculatePosition]);

  useEffect(() => {
    const newInput = formatInputValue(datePickerProps);
    if (newInput !== inputValue) {
      // we only set the input value if it has changed
      // otherwise the user loses the focus
      setInputValue(newInput);
    }
    setStatusWithMessage(undefined);
    setSelectedSlot(formatValueToSlot(datePickerProps));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return {
    showPicker,
    inputValue,
    statusWithMessage,
    selectedSlot,
    modalPosition,
    inputRef,
    calendarPickerRef,
    setShowPicker,
    handleDayClick,
    handleInputClick,
    handleInputOnChange,
  };
}
