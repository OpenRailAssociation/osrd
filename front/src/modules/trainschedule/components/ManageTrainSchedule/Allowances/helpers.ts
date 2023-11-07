import {
  AllowanceValueForm,
  FindAllowanceOverlapType,
  OverlapAllowancesIndexesType,
} from './types';

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
  return allowances.length > 0
    ? [
        before !== currentAllowanceSelected &&
          // Could be BEFORE the first allowance
          (beginPosition < allowances[0].begin_position ? 0 : before),
        after !== currentAllowanceSelected &&
          // Could be AFTER the last allowance
          (endPosition > allowances[allowances.length - 1].end_position &&
          beginPosition < allowances[allowances.length - 1].begin_position
            ? allowances.length - 1
            : after),
      ]
    : [-1, -1];
}

export default function getAllowanceValue(value: AllowanceValueForm) {
  switch (value.value_type) {
    case 'time_per_distance':
      return value.minutes;
    case 'time':
      return value.seconds;
    case 'percentage':
      return value.percentage;
    default:
      return undefined;
  }
}
