import { Duration } from 'utils/duration';

export const marginRegExValidation = /^(\d+(\.\d+)?)(%|min\/100km)$/;

export const MarginUnit = {
  percent: '%',
  minPer100km: 'min/100km',
  second: 's',
} as const;

export const ARRIVAL_TIME_ACCEPTABLE_ERROR = new Duration({ seconds: 2 });

/**
 * Fallback label used when a propagation delta cannot be computed yet.
 */
export const TIME_PROPAGATION_DEFAULT_DELTA = '+00:00:00';
