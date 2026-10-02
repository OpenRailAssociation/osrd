import { useState, useEffect, type EffectCallback, type DependencyList } from 'react';

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
export const useDebouncedFunc = <T = number | string | null>(
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
 * Debounce an effect (usage identical to react useEffect)
 */
export const useDebouncedEffect = (delay: number, effect: EffectCallback, deps: DependencyList) => {
  useEffect(() => {
    let destructor: (() => void) | void = undefined;
    const handler = setTimeout(() => {
      destructor = effect();
    }, delay);
    return () => {
      clearTimeout(handler);
      if (destructor) destructor();
    };
  }, [...deps, delay]);
};
