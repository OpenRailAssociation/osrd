import type { AllowanceValue } from 'applications/stdcm/types';

export const ALLOWANCE_UNITS_KEYS = {
  time: 's',
  percentage: '%',
  time_per_distance: 'min/100km',
} as const;

export const TYPES_UNITS = {
  time: 'seconds',
  percentage: 'percentage',
  time_per_distance: 'minutes',
} as const;

export type AllowanceUnitsKeys = keyof typeof ALLOWANCE_UNITS_KEYS;
export type AllowanceUnitskeysValues = (typeof ALLOWANCE_UNITS_KEYS)[AllowanceUnitsKeys];

export interface AllowanceType {
  id: AllowanceValue['value_type'];
  label: string;
  unit: AllowanceUnitskeysValues;
}

export function createAllowanceValue(
  type: AllowanceValue['value_type'] | undefined,
  value: number | undefined
): AllowanceValue {
  if (!type || !value) {
    return {
      value_type: 'percentage',
      percentage: 0,
    };
  }
  switch (type) {
    case 'time_per_distance':
      return {
        value_type: 'time_per_distance',
        minutes: value,
      };
    case 'time':
      return {
        value_type: 'time',
        seconds: value,
      };
    case 'percentage':
      return {
        value_type: 'percentage',
        percentage: value,
      };
    default:
      throw new Error(`Unsupported value_type: ${type}`);
  }
}
