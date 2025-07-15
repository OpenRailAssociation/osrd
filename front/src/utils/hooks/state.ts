/* eslint-disable import/prefer-default-export */
import { useRef, useEffect } from 'react';

export function usePrevious<T>(value: T) {
  const ref = useRef<T>(null);
  useEffect(() => {
    ref.current = value;
  }, [value]);
  return ref.current;
}
