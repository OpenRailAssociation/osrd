import { min } from 'lodash';

import type { LightRollingStockWithLiveries, TowedRollingStock } from 'common/api/osrdEditoastApi';
import { kmhToMs, msToKmh } from 'utils/physics';

// A common utility function to calculate the maximum speed for a consist.
/**
 * Calculate the maximum speed of a consist based on rolling stock, towed stock, and a speed limit tag.
 * @param {Object} params - The parameters for the calculation.
 * @param {LightRollingStockWithLiveries | undefined} params.rollingStock - The rolling stock details.
 * @param {TowedRollingStock | undefined} params.towed - The towed rolling stock details.
 * @param {number | undefined} params.speedLimit - The speed limit.
 * @returns {number | undefined} - The calculated maximum speed in km/h, or undefined if not applicable.
 */
const calculateConsistMaxSpeed = (
  rollingStock: LightRollingStockWithLiveries | undefined,
  towed: TowedRollingStock | undefined,
  speedLimit: number | undefined
) => {
  const consistMaxSpeed = min([
    rollingStock?.max_speed,
    towed?.max_speed,
    speedLimit ? kmhToMs(speedLimit) : undefined,
  ]);

  return consistMaxSpeed ? Math.floor(msToKmh(consistMaxSpeed)) : undefined;
};

export default calculateConsistMaxSpeed;
