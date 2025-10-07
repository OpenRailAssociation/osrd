import { compact, uniq } from 'lodash';

import type { RollingStock } from 'common/api/osrdEditoastApi';

/**
 * Return the power restriction codes of the rolling stock by mode
 *
 * ex: { "1500V": ["C1US", "C2US"], "25000V": ["M1US"], "thermal": []}
 */
export const getRollingStockPowerRestrictionsByMode = (
  rollingStockModes: RollingStock['effort_curves']['modes']
): { [mode: string]: string[] } => {
  const curvesModesKey = Object.keys(rollingStockModes);

  return curvesModesKey.reduce((result, mode) => {
    const powerCodes = rollingStockModes[mode].curves.map(
      (curve) => curve.cond.power_restriction_code
    );
    return {
      ...result,
      [mode]: compact(uniq(powerCodes)),
    };
  }, {});
};
