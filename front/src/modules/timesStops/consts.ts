import { Duration } from 'utils/duration';

export const marginRegExValidation = /^(\d+(\.\d+)?)(%|min\/100km)$/;

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

export const ONE_DAY = new Duration({ hours: 24 });
