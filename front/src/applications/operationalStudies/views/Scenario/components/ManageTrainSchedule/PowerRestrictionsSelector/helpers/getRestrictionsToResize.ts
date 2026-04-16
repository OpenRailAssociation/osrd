import { isEqual, sortBy } from 'lodash';

import type { PowerRestriction } from 'applications/operationalStudies/types';
import type { IntervalItem } from 'common/IntervalsEditor/types';
import { NO_POWER_RESTRICTION } from 'modules/powerRestriction/consts';
import type { PathStep } from 'reducers/osrdconf/types';

import { getPathStep } from './utils';

const getPowerRestrictionFromRange = (
  pathSteps: PathStep[],
  powerRestrictionRanges: PowerRestriction[],
  rangeData: IntervalItem | undefined
): PowerRestriction | undefined => {
  if (!rangeData) return undefined;

  const fromPathStep = getPathStep(pathSteps, rangeData.begin);
  const toPathStep = getPathStep(pathSteps, rangeData.end);

  if (!fromPathStep || !toPathStep) return undefined;

  const powerRestrictionRange = powerRestrictionRanges.find(
    (restriction) => restriction.from === fromPathStep.id && restriction.to === toPathStep.id
  );
  return powerRestrictionRange;
};

const getRestrictionsToResize = (
  firstRange: IntervalItem | undefined,
  secondRange: IntervalItem | undefined,
  pathSteps: PathStep[],
  powerRestrictionRanges: PowerRestriction[]
) => {
  const firstRestriction = getPowerRestrictionFromRange(
    pathSteps,
    powerRestrictionRanges,
    firstRange
  );

  const secondRestriction = getPowerRestrictionFromRange(
    pathSteps,
    powerRestrictionRanges,
    secondRange
  );

  return { firstRestriction, secondRestriction };
};

export const cleanCustomRanges = (
  customRanges: IntervalItem[],
  firstRange: IntervalItem | undefined,
  secondRange: IntervalItem | undefined,
  newPosition: number,
  pathLength: number
) => {
  // handle the case where we need to add a new range at the beginning or end of the path
  if (!firstRange || !secondRange) {
    if (customRanges.length === 0) {
      return [
        { begin: 0, end: newPosition, value: NO_POWER_RESTRICTION },
        { begin: newPosition, end: pathLength, value: NO_POWER_RESTRICTION },
      ];
    }
    if (firstRange?.end === pathLength) {
      return [
        ...customRanges,
        { begin: newPosition, end: pathLength, value: NO_POWER_RESTRICTION },
      ];
    }
    return [{ begin: 0, end: newPosition, value: NO_POWER_RESTRICTION }, ...customRanges];
  }

  // handle the case where at least one custom range is being resized
  let newCustomRanges = customRanges.reduce((acc, range) => {
    if (isEqual(range, firstRange)) {
      acc.push({
        ...range,
        end: newPosition,
      });
    } else if (isEqual(range, secondRange)) {
      acc.push({
        ...range,
        begin: newPosition,
      });
    }

    // keep the other ranges only if they are not overlapping with the resized ranges
    else if (secondRange.end <= range.begin && range.end <= firstRange.begin) {
      acc.push(range);
    }

    return acc;
  }, [] as IntervalItem[]);

  if (firstRange.value !== NO_POWER_RESTRICTION || secondRange.value !== NO_POWER_RESTRICTION) {
    return newCustomRanges;
  }

  // handle the case where a empty range (not customed yet) is being resized
  if (customRanges.every((range) => !isEqual(range, firstRange))) {
    newCustomRanges = [
      ...newCustomRanges,
      {
        begin: firstRange.begin,
        end: newPosition,
        value: NO_POWER_RESTRICTION,
      },
    ];
  }
  if (customRanges.every((range) => !isEqual(range, secondRange))) {
    newCustomRanges = [
      ...newCustomRanges,
      {
        begin: newPosition,
        end: secondRange.end,
        value: NO_POWER_RESTRICTION,
      },
    ];
  }

  return sortBy(newCustomRanges, 'begin');
};

export const getRangesToResize = (
  ranges: IntervalItem[],
  selectedRangeIndex: number,
  newPosition: number,
  context: 'begin' | 'end'
) => {
  const selectedRange = ranges[selectedRangeIndex];
  const selectedRangeHasBeenShortened =
    selectedRange.begin <= newPosition && newPosition <= selectedRange.end;

  let firstRange: IntervalItem | undefined;
  let secondRange: IntervalItem | undefined;

  if (context === 'begin') {
    secondRange = ranges[selectedRangeIndex];
    if (selectedRangeHasBeenShortened) {
      firstRange = selectedRangeIndex !== 0 ? ranges[selectedRangeIndex - 1] : undefined;
    } else {
      firstRange = ranges.find((range) => range.begin <= newPosition && newPosition <= range.end);
    }
  } else {
    firstRange = ranges[selectedRangeIndex];

    if (selectedRangeHasBeenShortened) {
      secondRange =
        selectedRangeIndex !== ranges.length - 1 ? ranges[selectedRangeIndex + 1] : undefined;
    } else {
      secondRange = ranges.find((range) => range.begin <= newPosition && newPosition <= range.end);
    }
  }

  return { firstRange, secondRange };
};

export default getRestrictionsToResize;
