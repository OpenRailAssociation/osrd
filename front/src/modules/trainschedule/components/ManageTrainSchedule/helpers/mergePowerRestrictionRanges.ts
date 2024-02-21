import { isEmpty } from 'lodash';

import type { PowerRestrictionRange } from 'applications/operationalStudies/consts';
import { replaceElementAtIndex } from 'utils/array';

// When two consecutive segments have the same power restriction code, they are merged into one. This prevents the back from returning an error.
function mergeIdenticalNeighbours(powerRestrictionRanges: PowerRestrictionRange[]) {
  return powerRestrictionRanges.reduce(
    (mergedArray: PowerRestrictionRange[], currentRange, index) => {
      if (index === 0 || currentRange.value !== powerRestrictionRanges[index - 1].value) {
        return mergedArray.concat(currentRange);
      }

      const previousRange = mergedArray[mergedArray.length - 1];
      const newPreviousRange = {
        ...previousRange,
        end: currentRange.end,
      };

      return replaceElementAtIndex(mergedArray, mergedArray.length - 1, newPreviousRange);
    },
    []
  );
}

const mergePowerRestrictionRanges = (powerRestrictionRanges: PowerRestrictionRange[]) => {
  if (isEmpty(powerRestrictionRanges)) {
    return null;
  }
  return mergeIdenticalNeighbours(powerRestrictionRanges).map((powerRestrictionRange) => ({
    begin_position: powerRestrictionRange.begin,
    end_position: powerRestrictionRange.end,
    power_restriction_code: powerRestrictionRange.value,
  }));
};

export default mergePowerRestrictionRanges;
