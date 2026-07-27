import { useState, useRef, useEffect } from 'react';

import type { StatusWithMessage } from '../StatusMessage';
import type { DatePickerProps } from './DatePicker';
import {
  computeNewSelectedSlot,
  containsOnlyNumbersAndSlashes,
  formatInputValue,
  formatValueToSlot,
  isWithinInterval,
} from './utils';

// Regex for "xx/xx/xx"
const SINGLE_DATE_REGEX = /^\d{2}\/\d{2}\/\d{2}$/;
// Same as above, but each group can be one or two digits
const FIXABLE_DATE_REGEX = /^\d{1,2}\/\d{1,2}\/\d{1,2}$/;

export default function useDatePicker(datePickerProps: DatePickerProps) {
  const { value, isRangeMode, selectableSlot, errorMessages, onDateChange } = datePickerProps;
  const [showPicker, setShowPicker] = useState(false);
  const [inputValue, setInputValue] = useState(formatInputValue(datePickerProps));
  const [selectedSlot, setSelectedSlot] = useState(formatValueToSlot(datePickerProps));
  const [statusWithMessage, setStatusWithMessage] = useState<StatusWithMessage>();
  const calendarPickerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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

  const handleBlur = () => {
    const isDate = SINGLE_DATE_REGEX.test(inputValue);
    const isFixableDate = !isDate && FIXABLE_DATE_REGEX.test(inputValue);
    if (isFixableDate) {
      const [day, month, year] = inputValue
        .split('/')
        .map((s: string) => (s.length === 1 ? `0${s}` : s));
      handleInputOnChange(`${day}/${month}/${year}`);
    } else if (!isDate) {
      setStatusWithMessage({
        status: 'error',
        message: errorMessages?.invalidInput,
      });
    }
  };

  useEffect(() => {
    const newInput = formatInputValue(datePickerProps);
    if (newInput !== inputValue) {
      // we only set the input value if it has changed
      // otherwise the user loses the focus
      // TODO: fix this lint
      /* eslint-disable-next-line react-hooks-js/set-state-in-effect */
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
    inputRef,
    calendarPickerRef,
    setShowPicker,
    handleDayClick,
    handleInputClick,
    handleInputOnChange,
    handleBlur,
  };
}
