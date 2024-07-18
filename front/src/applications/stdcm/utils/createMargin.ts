import type { StandardAllowance } from 'reducers/osrdconf/types';

export default function createMargin(margin: StandardAllowance | undefined): string {
  if (!margin || !margin.value) {
    return '0%';
  }
  switch (margin.type) {
    case 'time_per_distance':
      return `${margin.value}min/100km`;

    case 'percentage':
      return `${margin.value}%`;
    default:
      throw new Error(`Unsupported value_type: ${margin.type}`);
  }
}
