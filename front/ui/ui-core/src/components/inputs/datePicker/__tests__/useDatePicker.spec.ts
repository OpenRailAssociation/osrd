import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { type RangeDatePickerProps, type SingleDatePickerProps } from '..';
import useDatePicker from '../useDatePicker';

const errorMessages = {
  invalidDate: 'Invalid date',
  invalidInput: 'Invalid input',
};

describe('useDatePicker', () => {
  let onDayChange: RangeDatePickerProps['onDateChange'];
  let onSlotChange: SingleDatePickerProps['onDateChange'];

  beforeEach(() => {
    onDayChange = vi.fn();
    onSlotChange = vi.fn();
  });

  describe('day click on calendar handling', () => {
    describe('single mode', () => {
      it('should call onDateChange callback with the clicked date', () => {
        const { result } = renderHook(() =>
          useDatePicker({
            inputProps: { id: 'id', label: 'single' },
            isRangeMode: false,
            onDateChange: onDayChange,
          })
        );

        const clickedDate = new Date(2024, 0, 1);

        act(() => {
          result.current.handleDayClick(clickedDate);
        });

        expect(onDayChange).toHaveBeenCalledWith(clickedDate);
      });
    });

    describe('range mode', () => {
      it('should call onDateChange callback with the clicked date and the next slot', () => {
        const initialValue = { start: new Date(2024, 0, 1), end: null };
        const { result } = renderHook(() =>
          useDatePicker({
            inputProps: { id: 'id', label: 'range' },
            isRangeMode: true,
            value: initialValue,
            onDateChange: onSlotChange,
          })
        );

        const clickedDate = new Date(2024, 0, 2);
        act(() => {
          result.current.handleDayClick(clickedDate);
        });
        expect(onSlotChange).toHaveBeenCalledWith(clickedDate, {
          ...initialValue,
          end: clickedDate,
        });
      });
    });
  });

  describe('input click handling', () => {
    it('should not show the picker in single date mode', () => {
      const { result } = renderHook(() =>
        useDatePicker({
          inputProps: { id: 'id', label: 'label' },
          isRangeMode: false,
          onDateChange: onDayChange,
        })
      );

      act(() => {
        result.current.handleInputClick();
      });

      expect(result.current.showPicker).toBe(false);
    });

    it('should show the picker in range mode', () => {
      const { result } = renderHook(() =>
        useDatePicker({
          inputProps: { id: 'id', label: 'label' },
          isRangeMode: true,
          onDateChange: onDayChange,
        })
      );

      act(() => {
        result.current.handleInputClick();
      });

      expect(result.current.showPicker).toBe(true);
    });
  });

  describe('input change handling', () => {
    describe('single mode', () => {
      it.each(['toto', '01/01/2024', '01/i'])(
        'should show an error if the input is invalid (%i)',
        (newValue) => {
          const { result } = renderHook(() =>
            useDatePicker({
              inputProps: { id: 'id', label: 'label' },
              isRangeMode: false,
              onDateChange: onDayChange,
              errorMessages,
            })
          );

          act(() => {
            result.current.handleInputOnChange(newValue);
          });

          expect(result.current.inputValue).toBe(newValue);
          expect(result.current.statusWithMessage).toEqual({
            status: 'error',
            message: 'Invalid input',
          });
          expect(onDayChange).not.toBeCalled();
        }
      );

      it('should update the input value if the date string is not complete', () => {
        const { result } = renderHook(() =>
          useDatePicker({
            inputProps: { id: 'id', label: 'label' },
            isRangeMode: false,
            onDateChange: onDayChange,
            errorMessages,
          })
        );

        act(() => {
          result.current.handleInputOnChange('3/04/24');
        });

        expect(result.current.inputValue).toBe('3/04/24');
        expect(result.current.statusWithMessage).toBe(undefined);
        expect(onDayChange).not.toBeCalled();
      });

      it('should show an error if the date is not within the selectable slot', () => {
        const { result } = renderHook(() =>
          useDatePicker({
            selectableSlot: { start: new Date(2024, 0, 1), end: new Date(2024, 1, 1) },
            inputProps: { id: 'id', label: 'label' },
            isRangeMode: false,
            onDateChange: onDayChange,
            errorMessages,
          })
        );

        act(() => {
          result.current.handleInputOnChange('03/04/24');
        });

        expect(result.current.inputValue).toBe('03/04/24');
        expect(result.current.statusWithMessage).toEqual({
          status: 'error',
          message: 'Invalid date',
        });
        expect(onDayChange).not.toBeCalled();
      });

      it('should update the parent value is the date is valid', () => {
        const { result } = renderHook(() =>
          useDatePicker({
            inputProps: { id: 'id', label: 'label' },
            isRangeMode: false,
            onDateChange: onDayChange,
            errorMessages,
          })
        );

        act(() => {
          result.current.handleInputOnChange('01/02/24');
        });

        expect(result.current.inputValue).toBe('01/02/24');
        expect(result.current.statusWithMessage).toBe(undefined);
        expect(onDayChange).toHaveBeenCalledWith(new Date(2024, 1, 1));
      });
    });

    describe('range mode', () => {
      it('should do nothing in range mode', () => {
        const { result } = renderHook(() =>
          useDatePicker({
            value: { start: new Date(2024, 0, 1), end: null },
            inputProps: {
              id: 'id',
              label: 'label',
            },
            isRangeMode: true,
            onDateChange: onDayChange,
            errorMessages,
          })
        );

        act(() => {
          result.current.handleInputOnChange('01/02/24');
        });

        expect(result.current.inputValue).toBe('01/01/24 - ');
        expect(onDayChange).not.toBeCalled();
      });
    });
  });
});
