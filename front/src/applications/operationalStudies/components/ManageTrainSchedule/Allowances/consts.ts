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

export const unitsList = Object.keys(unitsLabels).map((unit) => ({
  id: unit,
  label: unitsLabels[unit as keyof typeof unitsLabels],
}));
