import type { EffortCurve } from 'common/api/osrdEditoastApi';

import type { ConditionalEffortCurveForm, EffortCurveForm } from '../types';

/** This function will sort the curves list based on the number of conditions they have.
 *
 * Curves will be sorted in the following order (comfort is compulsory):
 * - curves with all conditions (power restriction & electrical profile)
 * - curves with at least power restriction
 * - curves with least electrical profile
 * - other curves (without power restriction and without electrical profile)
 */
export const sortSelectedModeCurves = (curvesList: ConditionalEffortCurveForm[]) => {
  const { allConds, onlyPR, onlyEP, nulls } = curvesList.reduce(
    (sortedCurves, curve) => {
      const { cond } = curve;
      if (!cond) return sortedCurves;
      if (cond.electrical_profile_level && cond.power_restriction_code) {
        return { ...sortedCurves, allConds: [...sortedCurves.allConds, curve] };
      }
      if (cond.power_restriction_code) {
        return { ...sortedCurves, onlyPR: [...sortedCurves.onlyPR, curve] };
      }
      if (cond.electrical_profile_level) {
        return { ...sortedCurves, onlyEP: [...sortedCurves.onlyEP, curve] };
      }
      return { ...sortedCurves, nulls: [...sortedCurves.nulls, curve] };
    },
    { allConds: [], onlyPR: [], onlyEP: [], nulls: [] } as Record<
      string,
      ConditionalEffortCurveForm[]
    >
  );

  return allConds.concat(onlyPR, onlyEP, nulls);
};

export const filterNullValueInCurve = (curve: EffortCurveForm) =>
  curve.speeds.reduce<EffortCurve>(
    (result, speed, index) => {
      const maxEffort = curve.max_efforts[index];
      if (speed !== null && maxEffort !== null) {
        result.speeds.push(speed);
        result.max_efforts.push(maxEffort);
      }
      return result;
    },
    { speeds: [], max_efforts: [] }
  );
