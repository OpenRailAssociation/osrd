/* eslint-disable import/prefer-default-export */
import type { Comfort } from 'common/api/osrdEditoastApi';
import type { EffortCurveForms, ElectricalParamsLists } from 'modules/rollingStock/types';
import type { ValueOf } from 'utils/types';

/** Get the list of electrical profiles and power restrictions for an ModeEffortCurves */
export const getElectricalProfilesAndPowerRestrictions = (
  effortCurvesByMode: ValueOf<EffortCurveForms>,
  selectedComfortLvl: Comfort,
  selectedElectricalProfile: string | null
) =>
  effortCurvesByMode.curves.reduce<ElectricalParamsLists>(
    (result, curve) => {
      const { electrical_profile_level, power_restriction_code, comfort } = curve.cond;

      if (comfort === selectedComfortLvl) {
        if (electrical_profile_level === null) {
          result.electricalProfiles.unshift(electrical_profile_level);
        } else {
          result.electricalProfiles.push(electrical_profile_level);
        }
        if (electrical_profile_level === selectedElectricalProfile) {
          if (power_restriction_code === null) {
            result.powerRestrictions.unshift(power_restriction_code);
          } else {
            result.powerRestrictions.push(power_restriction_code);
          }
        }
      }

      return result;
    },
    { electricalProfiles: [], powerRestrictions: [] }
  );
