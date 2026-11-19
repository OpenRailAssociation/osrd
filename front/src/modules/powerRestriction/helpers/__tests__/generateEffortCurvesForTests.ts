import type { Comfort, LightEffortCurves } from 'common/api/osrdEditoastApi';

/**
 * Given a set of modes and some properties for their curves (electrical profile, power restriction code, and comfort),
 * generates a set of effort curves for each mode.
 */
const generateEffortCurvesForTests = (
  modes: Record<
    string,
    {
      electricalProfile: string;
      powerRestrictionCode: string | null;
      comfort?: Comfort;
    }[]
  >
) => {
  const results: LightEffortCurves['modes'] = {};
  for (const mode of Object.keys(modes)) {
    const powerRestrictionCodes = new Set<string>();
    for (const curve of modes[mode]) {
      if (curve.powerRestrictionCode) powerRestrictionCodes.add(curve.powerRestrictionCode);
    }
    results[mode] = {
      is_electric: true,
      power_restriction_codes: Array.from(powerRestrictionCodes),
    };
  }

  return results;
};

export default generateEffortCurvesForTests;
