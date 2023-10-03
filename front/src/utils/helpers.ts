import { useState, useEffect } from 'react';
import 'moment/locale/fr';

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
