import { compact, isEmpty, keyBy } from 'lodash';

import type { PowerRestrictionV2 } from 'applications/operationalStudies/types';
import type { RangedValue, RollingStock } from 'common/api/osrdEditoastApi';
import { NO_POWER_RESTRICTION } from 'modules/powerRestriction/consts';
import type { PowerRestrictionWarnings } from 'modules/powerRestriction/types';
import { getRollingStockPowerRestrictionsByMode } from 'modules/rollingStock/helpers/powerRestrictions';
import type { PathStep } from 'reducers/osrdconf/types';

// TODO drop v1: convert begin and end in meters here instead of in PowerRestrictionsSelectorV2
const getInvalidZoneBoundaries = (
  powerRestrictionRange: RangedValue,
  electrificationRange: RangedValue
) => {
  const invalidZoneBegin = Math.round(
    electrificationRange.begin < powerRestrictionRange.begin
      ? powerRestrictionRange.begin
      : electrificationRange.begin
  );
  const invalidZoneEnd = Math.round(
    powerRestrictionRange.end < electrificationRange.end
      ? powerRestrictionRange.end
      : electrificationRange.end
  );
  return { begin: invalidZoneBegin, end: invalidZoneEnd };
};

/**
 * Depending on the electrification on a train's path and the power restriction codes selected by the user,
 * returns the possible warnings based on the incompatibilty between them on each interval
 * @returns A dictionnary of warnings ordered by power restriction codes
 */
export const getPowerRestrictionsWarnings = (
  powerRestrictionRanges: RangedValue[],
  pathElectrificationRanges: RangedValue[],
  rollingStockModes: RollingStock['effort_curves']['modes']
): PowerRestrictionWarnings => {
  const powerRestrictionsByMode = getRollingStockPowerRestrictionsByMode(rollingStockModes);
  const warnings: PowerRestrictionWarnings = {
    invalidCombinationWarnings: [],
    modeNotSupportedWarnings: [],
    missingPowerRestrictionWarnings: [],
  };

  powerRestrictionRanges.forEach((powerRestrictionRange) => {
    // find path ranges crossed or included in the power restriction range
    pathElectrificationRanges.forEach((electrificationRange) => {
      // no intersection between the path range and the power restriction range
      if (
        electrificationRange.end <= powerRestrictionRange.begin ||
        powerRestrictionRange.end <= electrificationRange.begin
      )
        return;

      const { value: mode } = electrificationRange;
      const invalidZoneBoundaries = getInvalidZoneBoundaries(
        powerRestrictionRange,
        electrificationRange
      );
      if (mode in powerRestrictionsByMode) {
        const powerRestrictions = powerRestrictionsByMode[mode];
        const isInvalid = !powerRestrictions.includes(powerRestrictionRange.value);
        if (isInvalid) {
          if (powerRestrictionRange.value === NO_POWER_RESTRICTION) {
            warnings.missingPowerRestrictionWarnings.push({
              ...invalidZoneBoundaries,
            });
          } else {
            warnings.invalidCombinationWarnings.push({
              ...invalidZoneBoundaries,
              powerRestrictionCode: powerRestrictionRange.value,
              electrification: mode,
            });
          }
        }
      } else if (powerRestrictionRange.value !== NO_POWER_RESTRICTION) {
        // the mode is not supported by the rolling stock, so no power restriction should be defined
        // (the rolling stock uses thermal propulsion)
        warnings.modeNotSupportedWarnings.push({
          ...invalidZoneBoundaries,
          electrification: mode,
        });
      }
    });
  });

  return warnings;
};

export const countWarnings = (
  warnings: PowerRestrictionWarnings = {
    invalidCombinationWarnings: [],
    modeNotSupportedWarnings: [],
    missingPowerRestrictionWarnings: [],
  }
): number => {
  const { invalidCombinationWarnings, modeNotSupportedWarnings, missingPowerRestrictionWarnings } =
    warnings;
  return (
    invalidCombinationWarnings.length +
    modeNotSupportedWarnings.length +
    missingPowerRestrictionWarnings.length
  );
};

const formatElectricalRanges = (
  ranges: PowerRestrictionV2[],
  pathStepsById: Record<string, PathStep>
): { begin: number; end: number; value: string }[] => {
  const formattedRanges = compact(
    ranges.map((range) => {
      const begin = pathStepsById[range.from]?.positionOnPath;
      const end = pathStepsById[range.to]?.positionOnPath;

      if (begin !== undefined && end !== undefined) {
        return {
          begin,
          end,
          value: range.value,
        };
      }
      return null;
    })
  );
  return formattedRanges;
};

const getPowerRestrictionsWarningsData = ({
  pathSteps,
  pathElectrificationRanges,
  rollingStockModes,
  powerRestrictionRanges,
}: {
  pathSteps: PathStep[];
  rollingStockPowerRestrictions: RollingStock['power_restrictions'];
  pathElectrificationRanges: RangedValue[];
  powerRestrictionRanges: PowerRestrictionV2[];
  rollingStockModes: RollingStock['effort_curves']['modes'];
}) => {
  const pathStepsById = keyBy(pathSteps, 'id');
  const warnings =
    !isEmpty(pathElectrificationRanges) && !isEmpty(powerRestrictionRanges)
      ? getPowerRestrictionsWarnings(
          formatElectricalRanges(powerRestrictionRanges, pathStepsById),
          pathElectrificationRanges,
          rollingStockModes
        )
      : undefined;
  const warningsNb = warnings ? countWarnings(warnings) : 0;

  return {
    warnings,
    warningsNb,
  };
};

export default getPowerRestrictionsWarningsData;
