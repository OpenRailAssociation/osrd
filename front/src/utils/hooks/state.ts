import { useRef, useEffect } from 'react';

export function usePrevious<T>(value: T) {
  const ref = useRef<T>(null);
  useEffect(() => {
    ref.current = value;
  }, [value]);
  /* eslint-disable-next-line react/refs */
  return ref.current;
}
