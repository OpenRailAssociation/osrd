import { Allowance } from 'common/api/osrdEditoastApi';
import { unitsLabels } from './consts';
import {
  AllowanceForm,
  AllowanceValueForm,
  EngineeringAllowanceForm,
  FindAllowanceOverlapType,
  OverlapAllowancesIndexesType,
  RangeAllowanceForm,
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
    (allowance, index) =>
      !allowance.isDefault &&
      index !== currentAllowanceSelected &&
      beginPosition >= allowance.begin_position &&
      beginPosition <= allowance.end_position
  );
  const after = allowances.findIndex(
    (allowance, index) =>
      !allowance.isDefault &&
      index !== currentAllowanceSelected &&
      endPosition >= allowance.begin_position &&
      endPosition <= allowance.end_position
  );
  return allowances.length > 0 && (before !== -1 || after !== -1)
    ? [
        before !== currentAllowanceSelected &&
          // Could be BEFORE the first allowance
          (beginPosition < allowances[0].begin_position ? 0 : before),
        after !== currentAllowanceSelected &&
          // Could be AFTER the last allowance
          (endPosition > Math.round(allowances[allowances.length - 1].end_position) &&
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

// Allowances Linear View

export const getAllowanceToDisplay = (allowance: AllowanceValueForm) => ({
  value: getAllowanceValue(allowance),
  unit: unitsLabels[allowance.value_type],
});

const coloredDistribution = (
  specific: EngineeringAllowanceForm,
  global?: EngineeringAllowanceForm['distribution']
) => {
  if (global) return global;
  if (specific && specific.distribution) return specific.distribution;
  return undefined;
};

const valueToPercent = (value: number, pathLength: number) => (100 * value) / pathLength;

export function getAllowanceTag(
  allowance: RangeAllowanceForm | EngineeringAllowanceForm,
  pathLength: number,
  globalDistribution?: EngineeringAllowanceForm['distribution']
) {
  return {
    allowance: getAllowanceToDisplay(allowance.value),
    width: valueToPercent(allowance.end_position - allowance.begin_position, pathLength),
    leftOffset: valueToPercent(allowance.begin_position, pathLength),
    ...(allowance.isDefault
      ? {}
      : {
          distributionColor: coloredDistribution(
            allowance as EngineeringAllowanceForm,
            globalDistribution
          ),
        }),
  };
}

// Allowances Actions

export const getExactEndPosition = (
  endPosition: number,
  roundedPathLength: number,
  pathLength: number
) => (endPosition === roundedPathLength ? pathLength : endPosition);

const getNewDefaultAllowanceRange = (
  begin: number,
  end: number,
  defaultAllowance: AllowanceValueForm
): RangeAllowanceForm => ({
  begin_position: begin,
  end_position: end,
  value: { ...defaultAllowance },
  isDefault: true,
});

/**
 * Given an array of allowances, fill the empty ranges by default ranges
 *
 * Ex: [[begin: 0, end: 100], [begin: 500, end: 700]] with pathLength = 1000
 *  -> [[begin: 0, end: 100], [begin: 101, end: 499], [begin: 500, end: 700], [begin: 701, end: 1000]]
 */
export const fillAllowancesWithDefaultRanges = (
  allowances: RangeAllowanceForm[],
  defaultAllowance: AllowanceValueForm,
  pathLength: number
) => {
  const filteredAllowances = allowances.filter((allowance) => !allowance.isDefault);
  return filteredAllowances.reduce((result, allowance, index) => {
    // first allowance
    let firstDefaultAllowance = [] as RangeAllowanceForm[];
    if (index === 0 && allowance.begin_position > 0) {
      firstDefaultAllowance = [
        getNewDefaultAllowanceRange(0, allowance.begin_position - 1, defaultAllowance),
      ];
    }

    // last allowance
    if (index === filteredAllowances.length - 1) {
      return [
        ...result,
        ...firstDefaultAllowance,
        allowance,
        ...(Math.round(allowance.end_position) === Math.round(pathLength)
          ? ([] as RangeAllowanceForm[])
          : [
              getNewDefaultAllowanceRange(allowance.end_position + 1, pathLength, defaultAllowance),
            ]),
      ];
    }

    const nextAllowance = filteredAllowances[index + 1];
    if (allowance.end_position + 1 === nextAllowance.begin_position) {
      return [...result, ...firstDefaultAllowance, allowance];
    }
    return [
      ...result,
      ...firstDefaultAllowance,
      allowance,
      getNewDefaultAllowanceRange(
        allowance.end_position + 1,
        nextAllowance.begin_position - 1,
        defaultAllowance
      ),
    ];
  }, [] as RangeAllowanceForm[]);
};

export const getFirstEmptyRange = (
  allowances: RangeAllowanceForm[],
  pathLength: number,
  startPosition = 0
) => {
  if (allowances.length === 0) {
    return { beginPosition: 0, endPosition: Math.round(pathLength) };
  }

  return allowances.reduce((result, allowance, index) => {
    if (result) return result;
    // default range element
    if (allowance.isDefault) {
      return { beginPosition: allowance.begin_position, endPosition: allowance.end_position };
    }
    // first element
    if (index === 0 && allowance.begin_position > startPosition) {
      return { beginPosition: startPosition, endPosition: allowance.begin_position - 1 };
    }
    // last element
    if (index === allowances.length - 1) {
      if (allowance.end_position < pathLength) {
        return { beginPosition: allowance.end_position + 1, endPosition: Math.round(pathLength) };
      }
      return null;
    }
    // get next element and check if there is an empty range before current and next element
    const nextAllowance = allowances[index + 1];
    if (allowance.end_position + 1 !== nextAllowance.begin_position) {
      return {
        beginPosition: allowance.end_position + 1,
        endPosition: nextAllowance.begin_position - 1,
      };
    }
    return null;
  }, null as null | { beginPosition: number; endPosition: number });
};

export const getFirstEmptyRangeFromPosition = (
  allowances: RangeAllowanceForm[],
  startPosition: number,
  pathLength: number
) => {
  if (allowances.length === 0) {
    return { beginPosition: 0, endPosition: Math.round(pathLength) };
  }

  const allowancesFromStartPosition = allowances
    .filter((allowance) => allowance.end_position > startPosition)
    .map((allowance) =>
      allowance.begin_position < startPosition
        ? {
            ...allowance,
            begin_position: startPosition,
          }
        : allowance
    );
  return allowancesFromStartPosition.length
    ? getFirstEmptyRange(allowancesFromStartPosition, pathLength, startPosition)
    : null;
};

export const formatAllowances = (allowances: AllowanceForm[]): Allowance[] =>
  allowances.map((allowance) => {
    if (allowance.allowance_type === 'standard') {
      return {
        ...allowance,
        ranges: allowance.ranges.filter((range) => !range.isDefault),
      } as Allowance;
    }
    return allowance as Allowance;
  });
