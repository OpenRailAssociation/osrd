import { min } from 'lodash';

import type { LightRollingStockWithLiveries, TowedRollingStock } from 'common/api/osrdEditoastApi';
import { kmhToMs, msToKmh } from 'utils/physics';

import maxSpeedFromSpeedLimitByTag from './maxSpeedFromSpeedLimitByTag';

// A common utility function to calculate the maximum speed for a consist.
/**
 * Calculate the maximum speed of a consist based on rolling stock, towed stock, and a speed limit tag.
 * @param {Object} params - The parameters for the calculation.
 * @param {LightRollingStockWithLiveries | undefined} params.rollingStock - The rolling stock details.
 * @param {TowedRollingStock | undefined} params.towed - The towed rolling stock details.
 * @param {string | null | undefined} params.speedLimitTag - The speed limit tag to determine max speed.
 * @returns {number | undefined} - The calculated maximum speed in km/h, or undefined if not applicable.
 */
const calculateConsistMaxSpeed = (
  rollingStock: LightRollingStockWithLiveries | undefined,
  towed: TowedRollingStock | undefined,
  speedLimitTag: string | null | undefined
) => {
  const maxSpeedFromTag = maxSpeedFromSpeedLimitByTag(speedLimitTag);
  const consistMaxSpeed = min([
    rollingStock?.max_speed,
    towed?.max_speed,
    maxSpeedFromTag ? kmhToMs(maxSpeedFromTag) : undefined,
  ]);

  return consistMaxSpeed ? Math.floor(msToKmh(consistMaxSpeed)) : undefined;
};

export default calculateConsistMaxSpeed;
