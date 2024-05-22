import { groupBy, type Dictionary } from 'lodash';

import type { RangedValue, RollingStock } from 'common/api/osrdEditoastApi';
import NO_POWER_RESTRICTION from 'modules/powerRestriction/consts';
import type { PowerRestrictionWarning } from 'modules/powerRestriction/types';
import { getRollingStockPowerRestrictionsByMode } from 'modules/rollingStock/helpers/powerRestrictions';

/**
 * Depending on the electrification on a train's path and the power restriction codes selected by the user,
 * returns the possible warnings based on the incompatibilty between them on each interval
 * @returns A dictionnary of warnings ordered by power restriction codes
 */
export const getPowerRestrictionsWarnings = (
  powerRestrictionRanges: RangedValue[],
  pathElectrificationRanges: RangedValue[],
  rollingStockModes: RollingStock['effort_curves']['modes']
): Dictionary<PowerRestrictionWarning[]> => {
  const powerRestrictionsByMode = getRollingStockPowerRestrictionsByMode(rollingStockModes);
  const warnings: PowerRestrictionWarning[] = [];

  powerRestrictionRanges.forEach((powerRestrictionRange) => {
    // find path ranges crossed or included in the power restriction range
    pathElectrificationRanges.forEach((pathElectrificationRange) => {
      // no intersection between the path range and the power restriction range
      if (
        pathElectrificationRange.end <= powerRestrictionRange.begin ||
        powerRestrictionRange.end <= pathElectrificationRange.begin
      )
        return;
      // check restriction is compatible with the path range's electrification mode
      const isInvalid = !powerRestrictionsByMode[pathElectrificationRange.value].includes(
        powerRestrictionRange.value
      );
      if (isInvalid) {
        const invalidZoneBegin = Math.round(
          pathElectrificationRange.begin < powerRestrictionRange.begin
            ? powerRestrictionRange.begin
            : pathElectrificationRange.begin
        );
        const invalidZoneEnd = Math.round(
          powerRestrictionRange.end < pathElectrificationRange.end
            ? powerRestrictionRange.end
            : pathElectrificationRange.end
        );

        warnings.push({
          ...(powerRestrictionRange.value !== NO_POWER_RESTRICTION
            ? {
                powerRestrictionCode: powerRestrictionRange.value,
                electrification: pathElectrificationRange.value,
              }
            : {
                powerRestrictionCode: NO_POWER_RESTRICTION,
              }),
          begin: invalidZoneBegin,
          end: invalidZoneEnd,
        });
      }
    });
  });
  return groupBy(warnings, 'powerRestrictionCode');
};

export const countWarnings = (warnings: Dictionary<PowerRestrictionWarning[]>): number =>
  Object.values(warnings).reduce((totalCount, warning) => totalCount + warning.length, 0);
