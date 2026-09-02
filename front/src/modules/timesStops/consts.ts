import { Duration } from 'utils/duration';

export const MarginUnit = {
  percent: '%',
  minPer100km: 'min/100km',
  second: 's',
} as const;

export const ARRIVAL_TIME_ACCEPTABLE_ERROR = new Duration({ seconds: 2 });

export const marginsUndefined = {
  theoreticalMargin: undefined,
  isTheoreticalMarginBoundary: undefined,
  theoreticalMarginSeconds: undefined,
  calculatedMargin: undefined,
  diffMargins: undefined,
} as const;
