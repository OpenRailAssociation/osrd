import { AllowanceValue } from 'common/api/osrdEditoastApi';

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

export const ALLOWANCE_UNIT_TYPES = {
  TIME: 'time',
  PERCENTAGE: 'percentage',
  TIME_PER_DISTANCE: 'time_per_distance',
};

export type AllowanceUnitsKeys = keyof typeof ALLOWANCE_UNITS_KEYS;
export type AllowanceUnitskeysValues = (typeof ALLOWANCE_UNITS_KEYS)[AllowanceUnitsKeys];

export interface AllowanceType {
  id: AllowanceValue['value_type'];
  label: string;
  unit: AllowanceUnitskeysValues;
}
