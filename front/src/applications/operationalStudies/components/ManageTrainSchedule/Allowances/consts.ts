import { StandardAllowance } from 'common/api/osrdEditoastApi';

export enum unitsNames {
  time_per_distance = 'minutes',
  time = 'seconds',
  percentage = 'percentage',
}

export enum unitsLabels {
  time_per_distance = 'min/100km',
  time = 's',
  percentage = '%',
}

export const initialStandardAllowance: StandardAllowance = {
  allowance_type: 'standard',
  default_value: {
    value_type: 'time',
    seconds: 0,
  },
  ranges: [],
  distribution: 'MARECO',
  capacity_speed_limit: 30,
};

export const unitsList = Object.keys(unitsLabels).map((unit) => ({
  id: unit,
  label: unitsLabels[unit as keyof typeof unitsLabels],
}));
