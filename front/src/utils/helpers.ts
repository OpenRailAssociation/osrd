import { useState, useEffect } from 'react';

/**
 * Debounce input fields
 */
export const useDebounce = <T = string | number>(value: T, delay: number): T => {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);
  return debouncedValue;
};

/**
 * Debounce function
 */
export const useDebouncedFunc = <T = (number | null) | (string | null)>(
  value: T,
  delay: number,
  func: (newValue: T) => void
) => {
  useEffect(() => {
    const handler = setTimeout(() => {
      func(value);
    }, delay);
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);
};

/**
 * Given a boolean isHovering, returns the pointer class string
 */
export function getCursorClass(isHovering: boolean): 'pointer' | 'default' {
  return isHovering ? 'pointer' : 'default';
}

/**
 * Given a boolean isVisible, returns the corresponding class string
 */
export function getVisibilityClass(isVisible: boolean): 'visible' | 'none' {
  return isVisible ? 'visible' : 'none';
}

/**
 * Round the given value to the 10 000th
 */
export function gpsRound(val: number) {
  return Math.round(val * 10000) / 10000;
}

/**
 * Creates a search datetime window from tomorrow (J+1) to 8 days from now (J+8)
 * @returns Object with begin and end dates
 */
export const getDefaultSearchDatetimeWindow = () => {
  const today = new Date();

  const begin = new Date(today);
  begin.setDate(begin.getDate() + 1);

  const end = new Date(today);
  end.setDate(end.getDate() + 8);

  return { begin, end };
};
