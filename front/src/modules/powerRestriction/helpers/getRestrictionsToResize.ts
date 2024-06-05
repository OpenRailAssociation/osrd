import type { PowerRestrictionV2 } from 'applications/operationalStudies/types';
import type { IntervalItem } from 'common/IntervalsEditor/types';
import type { PathStep } from 'reducers/osrdconf/types';

import { getPathStep } from './utils';
import { NO_POWER_RESTRICTION } from '../consts';

const getPowerRestrictionFromRange = (
  pathSteps: PathStep[],
  powerRestrictionRanges: PowerRestrictionV2[],
  rangeData: IntervalItem
): PowerRestrictionV2 | null => {
  const fromPathStep = getPathStep(pathSteps, rangeData.begin);
  const toPathStep = getPathStep(pathSteps, rangeData.end);

  if (!fromPathStep || !toPathStep) return null;

  const powerRestrictionRange = powerRestrictionRanges.find(
    (restriction) => restriction.from === fromPathStep.id && restriction.to === toPathStep.id
  );
  return powerRestrictionRange || null;
};

/**
 * Given the new position of the modified extremity, return the powerRestrictions to update
 */
const getPowerRestrictionsToUpdate = (
  pathSteps: PathStep[],
  powerRestrictionRanges: PowerRestrictionV2[],
  ranges: IntervalItem[],
  position: number,
  selectedRangeIndex: number
) => {
  const selectedRange = ranges[selectedRangeIndex];
  const selectedRestriction = getPowerRestrictionFromRange(
    pathSteps,
    powerRestrictionRanges,
    selectedRange
  );
  if (!selectedRestriction) return null;

  const otherRangeIndex = ranges.findIndex(
    (range) => range.begin <= position && position <= range.end
  );

  const otherRange = otherRangeIndex !== selectedRangeIndex ? ranges[otherRangeIndex] : undefined;

  if (!otherRange || otherRange.value === NO_POWER_RESTRICTION)
    return { selectedRange, selectedRestriction };

  const otherRestriction = getPowerRestrictionFromRange(
    pathSteps,
    powerRestrictionRanges,
    otherRange
  );
  return { selectedRange, selectedRestriction, otherRange, otherRestriction };
};

const getRestrictionsToResize = (
  ranges: IntervalItem[],
  selectedRangeIndex: number,
  context: 'begin' | 'end',
  newPosition: number,
  pathSteps: PathStep[],
  powerRestrictionRanges: PowerRestrictionV2[]
) => {
  const result = getPowerRestrictionsToUpdate(
    pathSteps,
    powerRestrictionRanges,
    ranges,
    newPosition,
    selectedRangeIndex
  );
  if (!result) return null;

  const { selectedRange, selectedRestriction, otherRange, otherRestriction } = result;

  let firstRestriction: PowerRestrictionV2 | undefined;
  let secondRestriction: PowerRestrictionV2 | undefined;
  if (context === 'begin') {
    // default hypothesis: the begin was decremented
    firstRestriction = otherRestriction || undefined;
    secondRestriction = selectedRestriction;

    if (otherRange && otherRestriction && otherRange.begin > selectedRange.begin) {
      firstRestriction = selectedRestriction;
      secondRestriction = otherRestriction;
    }
  } else {
    // default hypothesis: the end was incremented
    firstRestriction = selectedRestriction;
    secondRestriction = otherRestriction || undefined;

    if (otherRange && otherRestriction && otherRange.begin < selectedRange.begin) {
      firstRestriction = otherRestriction;
      secondRestriction = selectedRestriction;
    }
  }

  return { firstRestriction, secondRestriction };
};

export default getRestrictionsToResize;
