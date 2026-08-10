import { sortBy } from 'lodash';

import type { IntervalItem } from 'common/IntervalsEditor/types';
import { NO_POWER_RESTRICTION } from 'modules/powerRestriction/consts';

/**
 * Cut the correct range for a given position and add the new ranges to the
 * customRanges array if needed
 */
export const cutRange = (
  allRanges: IntervalItem[],
  customRanges: IntervalItem[],
  pathLength: number, // in m
  newCutPosition: number // in m
) => {
  if (newCutPosition >= pathLength) {
    throw Error('Invalid cut position: can not properly insert the new range');
  }

  if (allRanges.length === 1) {
    return [
      { begin: 0, end: newCutPosition, value: allRanges[0].value },
      { begin: newCutPosition, end: pathLength, value: allRanges[0].value },
    ];
  }

  for (let i = 0; i < allRanges.length; i++) {
    // if the cut position is smaller than the current range begin, we insert new ranges before the current one
    if (allRanges[i].begin < newCutPosition && newCutPosition < allRanges[i].end) {
      return sortBy(
        [
          ...customRanges.filter(
            (range) => range.begin !== allRanges[i].begin || range.end !== allRanges[i].end
          ),
          { begin: allRanges[i].begin, end: newCutPosition, value: NO_POWER_RESTRICTION },
          { begin: newCutPosition, end: allRanges[i].end, value: NO_POWER_RESTRICTION },
        ],
        'begin'
      );
    }
  }
  throw Error('Invalid cut position: can not properly insert the new range');
};
