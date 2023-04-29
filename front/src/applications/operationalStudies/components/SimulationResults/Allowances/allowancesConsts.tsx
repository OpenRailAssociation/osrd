import { AllowanceValue } from 'common/api/osrdMiddlewareApi';

export const ALLOWANCE_UNITS_KEYS = {
  time: 's',
  percentage: '%',
  time_per_distance: 'min/100km',
};

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

export interface AllowanceType {
  id: AllowanceValue['value_type'];
  label: string;
  unit: string;
}
