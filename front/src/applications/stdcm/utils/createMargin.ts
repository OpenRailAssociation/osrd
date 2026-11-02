import type { StandardAllowance } from 'reducers/osrdconf/types';

import type { MarginType } from '../types';

export default function createMargin(margin: StandardAllowance | undefined): string {
  if (!margin || !margin.value) {
    return '0%';
  }
  switch (margin.type) {
    case 'time_per_distance' as MarginType.TIME_PER_DISTANCE:
      return `${margin.value}min/100km`;
    case 'percentage' as MarginType.PERCENTAGE:
      return `${margin.value}%`;
    default:
      throw new Error(`Unsupported value_type: ${margin.type}`);
  }
}
