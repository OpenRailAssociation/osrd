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
