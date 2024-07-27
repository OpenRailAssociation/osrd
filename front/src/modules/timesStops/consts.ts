export const marginRegExValidation = /^(\d+(\.\d+)?)(%|min\/100km)$/;

export const MarginUnit = {
  percent: '%',
  minPer100km: 'min/100km',
  second: 's',
} as const;

export const ARRIVAL_TIME_ACCEPTABLE_ERROR_MS = 1000;
