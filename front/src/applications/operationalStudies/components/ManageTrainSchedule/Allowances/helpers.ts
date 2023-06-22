import { AllowanceValue } from 'common/api/osrdEditoastApi';
import { FindAllowanceOverlapType, OverlapAllowancesIndexesType } from './types';

export function findAllowanceOverlap({
  allowances,
  beginPosition,
  endPosition,
  currentAllowanceSelected,
}: FindAllowanceOverlapType): OverlapAllowancesIndexesType {
  const before = allowances.findIndex(
    (allowance) =>
      beginPosition >= allowance.begin_position && beginPosition <= allowance.end_position
  );
  const after = allowances.findIndex(
    (allowance) => endPosition >= allowance.begin_position && endPosition <= allowance.end_position
  );
  return [
    before !== currentAllowanceSelected && before,
    after !== currentAllowanceSelected && after,
  ];
}

export default function getAllowanceValue(value?: AllowanceValue) {
  switch (value?.value_type) {
    case 'time_per_distance':
      return value.minutes || 0;
    case 'time':
      return value.seconds || 0;
    case 'percentage':
      return value.percentage || 0;
    default:
      return 0;
  }
}
