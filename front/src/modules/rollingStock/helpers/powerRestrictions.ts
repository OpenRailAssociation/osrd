import type { LightRollingStock } from 'common/api/osrdEditoastApi';

/**
 * Return the power restriction codes of the rolling stock by mode
 *
 * ex: { "1500V": ["C1US", "C2US"], "25000V": ["M1US"], "thermal": []}
 */
export const getRollingStockPowerRestrictionsByMode = (
  rollingStockModes: LightRollingStock['effort_curves']['modes']
): { [mode: string]: string[] } => {
  const curvesModesKey = Object.keys(rollingStockModes);

  return curvesModesKey.reduce((result, mode) => {
    const powerCodes = rollingStockModes[mode].power_restriction_codes;
    if (!powerCodes) return result;

    return {
      ...result,
      [mode]: powerCodes,
    };
  }, {});
};
