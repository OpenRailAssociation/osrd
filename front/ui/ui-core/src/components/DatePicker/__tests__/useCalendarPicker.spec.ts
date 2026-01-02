import { renderHook, act } from '@testing-library/react';
import { beforeEach, afterEach, describe, expect, it } from 'vitest';

import { august, december, february, january, july, june } from './useCalendar.spec';
import useCalendarPicker from '../useCalendarPicker';
import {
  generateSequentialDates,
  INVALID_SELECTED_SLOT_ERROR,
  INVALID_SELECTABLE_SLOT_ERROR,
  INVALID_SELECTED_SLOT_BASED_ON_SELECTABLE_SLOT_ERROR,
  INVALID_INITIAL_DATE_ERROR,
} from '../utils';

const errorsToIgnore = [
  INVALID_SELECTED_SLOT_ERROR,
  INVALID_SELECTABLE_SLOT_ERROR,
  INVALID_SELECTED_SLOT_BASED_ON_SELECTABLE_SLOT_ERROR,
  INVALID_INITIAL_DATE_ERROR,
];

describe('useCalendarPicker', () => {
  describe('Initialization', () => {
    let originalConsoleError: typeof console.error;

    beforeEach(() => {
      // Ignore expected errors to avoid to pollute the test output
      originalConsoleError = console.error;
      console.error = (...args) => {
        const isErrorToIgnore = errorsToIgnore.some((errorMsg) => args[0].includes(errorMsg));
        const isReactError = args[0].includes(
          'The above error occurred in the <TestComponent> component:'
        );
        if (!isErrorToIgnore && !isReactError) {
          originalConsoleError(...args);
        }
      };
    });

    afterEach(() => {
      console.error = originalConsoleError;
    });

    it('should initialize with the correct default values', () => {
      const { result } = renderHook(() => useCalendarPicker({}));

      const expectedDates = generateSequentialDates(new Date(), 1);

      expect(result.current.displayedMonthsStartDates).toEqual(expectedDates);
      expect(result.current.showNavigationBtn).toEqual(true);
      expect(result.current.canGoToNextMonth).toEqual(true);
      expect(result.current.canGoToPreviousMonth).toEqual(true);
    });

    it('should throw an error if selectedSlot is not valid', () => {
      expect(() =>
        renderHook(() =>
          useCalendarPicker({
            selectedSlot: { start: new Date(2024, february, 2), end: new Date(2024, february, 1) },
          })
        )
      ).toThrowError();
    });

    it('should throw an error if selectableSlot is not valid', () => {
      const selectableSlot = {
        start: new Date(2024, february, 2),
        end: new Date(2024, february, 1),
      };

      expect(() => renderHook(() => useCalendarPicker({ selectableSlot }))).toThrowError();
    });

    it('should throw an error if selectedSlot is not within selectableSlot', () => {
      const selectedSlot = { start: new Date(2024, february, 1), end: new Date(2024, february, 2) };
      const selectableSlot = {
        start: new Date(2024, february, 3),
        end: new Date(2024, february, 4),
      };

      expect(() =>
        renderHook(() => useCalendarPicker({ selectedSlot, selectableSlot }))
      ).toThrowError();
    });

    it('should throw an error when initialDate is not a valid date', () => {
      const initialDate = new Date(2024, february, 1);
      const selectableSlot = {
        start: new Date(2024, february, 3),
        end: new Date(2024, february, 4),
      };

      expect(() =>
        renderHook(() => useCalendarPicker({ initialDate, selectableSlot }))
      ).toThrowError();
    });
  });

  describe('Navigation handling', () => {
    it('should navigate to the next month correctly during the year', () => {
      const initialDate = new Date(2024, july, 1);
      const { result } = renderHook(() => useCalendarPicker({ initialDate }));
      act(() => result.current.handleGoToNextMonth());

      expect(result.current.displayedMonthsStartDates[0].getMonth()).toBe(august);
      expect(result.current.displayedMonthsStartDates[0].getFullYear()).toBe(2024);
    });

    it('should navigate to the next month correctly at the end of the year', () => {
      const initialDate = new Date(2024, december, 1);
      const { result } = renderHook(() => useCalendarPicker({ initialDate }));
      act(() => result.current.handleGoToNextMonth());

      expect(result.current.displayedMonthsStartDates[0].getMonth()).toBe(january);
      expect(result.current.displayedMonthsStartDates[0].getFullYear()).toBe(2025);
    });

    it('should navigate to the previous month correctly during the year', () => {
      const initialDate = new Date(2024, july, 1);
      const { result } = renderHook(() => useCalendarPicker({ initialDate }));
      act(() => result.current.handleGoToPreviousMonth());

      expect(result.current.displayedMonthsStartDates[0].getMonth()).toBe(june);
      expect(result.current.displayedMonthsStartDates[0].getFullYear()).toBe(2024);
    });

    it('should navigate to the previous month correctly at the start of the year', () => {
      const initialDate = new Date(2024, january, 1);
      const { result } = renderHook(() => useCalendarPicker({ initialDate }));
      act(() => result.current.handleGoToPreviousMonth());

      expect(result.current.displayedMonthsStartDates[0].getMonth()).toBe(december);
      expect(result.current.displayedMonthsStartDates[0].getFullYear()).toBe(2023);
    });
  });

  describe('Month display', () => {
    it('should display the correct number of months', () => {
      const { result } = renderHook(() => useCalendarPicker({ numberOfMonths: 3 }));
      expect(result.current.displayedMonthsStartDates.length).toBe(3);
    });

    it('should display the correct start dates for each month', () => {
      const { result } = renderHook(() => useCalendarPicker({ numberOfMonths: 3 }));
      const startDates = result.current.displayedMonthsStartDates;

      for (let i = 0; i < startDates.length - 1; i++) {
        const currentMonth = startDates[i].getMonth();
        const nextMonth = startDates[i + 1].getMonth();
        const expectedMonth = (currentMonth + 1) % 12;
        expect(nextMonth).toBe(expectedMonth);
      }
    });
  });
});
