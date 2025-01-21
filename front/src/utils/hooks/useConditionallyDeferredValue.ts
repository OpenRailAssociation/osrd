import { useDeferredValue } from 'react';

/**
 * expends on the behavior of react hook useDeferredValue
 * returns a deferred value if the condition is met
 * returns the normal value otherwise
 */
export default function useConditionallyDeferredValue<T>(value: T, condition: boolean) {
  const deferredValue = useDeferredValue(value);
  if (condition) {
    return deferredValue;
  }
  return value;
}
