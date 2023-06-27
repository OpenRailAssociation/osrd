import { AllowanceValue } from 'common/api/osrdEditoastApi';
import { FindAllowanceOverlapType, OverlapAllowancesIndexesType } from './types';

// Return an array containing index of allowances that are included in range of begin & end position
// Could be -1 if no overlap, false if it's the selected allowance (to allow update) or the index of allowance
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
    before !== currentAllowanceSelected &&
      // Could be BEFORE the first allowance
      (beginPosition < allowances[0].begin_position ? 0 : before),
    after !== currentAllowanceSelected &&
      // Could be AFTER the last allowance
      (endPosition > allowances[allowances.length - 1].end_position
        ? allowances.length - 1
        : after),
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
