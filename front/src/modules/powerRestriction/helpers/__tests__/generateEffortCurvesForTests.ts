import type { Comfort, EffortCurves } from 'common/api/osrdEditoastApi';

/**
 * Given a set of modes and some properties for their curves (electrical profile, power restriction code, and comfort),
 * generates a set of effort curves for each mode.
 */
const generateEffortCurvesForTests = (
  modes: Record<
    string,
    { electricalProfile: string; powerRestrictionCode: string | null; comfort?: Comfort }[]
  >
) => {
  const results: EffortCurves['modes'] = {};
  for (const mode of Object.keys(modes)) {
    const curves = modes[mode].map((curve) => ({
      cond: {
        comfort: curve.comfort || null,
        electrical_profile_level: curve.electricalProfile,
        power_restriction_code: curve.powerRestrictionCode,
      },
      curve: {
        max_efforts: [100, 200, 300],
        speeds: [50, 100, 150],
      },
    }));

    results[mode] = {
      curves,
      default_curve: {
        max_efforts: [100, 200, 300],
        speeds: [50, 100, 150],
      },
      is_electric: true,
    };
  }

  return results;
};

export default generateEffortCurvesForTests;
