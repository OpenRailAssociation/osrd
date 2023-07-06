import { StandardAllowance } from 'common/api/osrdEditoastApi';

export enum unitsTypes {
  percentage = 'percentage',
  time_per_distance = 'time_per_distance',
  time = 'time',
}

export enum unitsNames {
  percentage = 'percentage',
  time_per_distance = 'minutes',
  time = 'seconds',
}

export enum unitsLabels {
  percentage = '%',
  time_per_distance = 'min/100km',
  time = 's',
}

export const initialStandardAllowance: StandardAllowance = {
  allowance_type: 'standard',
  default_value: {
    value_type: 'percentage',
    percentage: 0,
  },
  ranges: [],
  distribution: 'MARECO',
};

export const unitsList = Object.keys(unitsLabels).map((unit) => ({
  id: unit,
  label: unitsLabels[unit as keyof typeof unitsLabels],
}));
