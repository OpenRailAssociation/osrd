import type { PowerRestrictionRange } from 'applications/operationalStudies/consts';
import type { RangedValue } from 'common/api/osrdEditoastApi';

import NO_POWER_RESTRICTION from '../consts';

// Displays power restriction with electrification intervals to make it easier for the user to use the editor.
export default function displayPowerRestrictionIntervals(
  formattedPathElectrificationRanges: RangedValue[],
  powerRestrictionRanges: PowerRestrictionRange[]
) {
  const formattedRanges: RangedValue[] = [];

  formattedPathElectrificationRanges.forEach((electrificationRange) => {
    const overlappingRanges = powerRestrictionRanges.filter(
      (range) => electrificationRange.end > range.begin && electrificationRange.begin < range.end
    );

    if (overlappingRanges.length === 0) {
      formattedRanges.push({
        begin: electrificationRange.begin,
        end: electrificationRange.end,
        value: NO_POWER_RESTRICTION,
      });
    } else {
      overlappingRanges.forEach((range) => {
        const begin = Math.max(range.begin, electrificationRange.begin);
        const end = Math.min(range.end, electrificationRange.end);
        formattedRanges.push({
          begin,
          end,
          value: range.value,
        });
      });
    }
  });

  formattedRanges.sort((a, b) => a.begin - b.begin);

  return formattedRanges;
}
