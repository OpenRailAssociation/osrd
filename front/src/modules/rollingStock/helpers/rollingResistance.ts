import type { RollingResistancePerWeight } from 'common/api/osrdEditoastApi';

import type { MultiUnit } from '../types';

type RollingResistanceCoefficients = Pick<RollingResistancePerWeight, 'A' | 'B' | 'C'>;

const METERS_PER_SECOND_TO_KILOMETERS_PER_HOUR = 3.6;

/** Per-ton units used to display and edit the API's per-weight coefficients. */
export const ROLLING_RESISTANCE_DISPLAY_UNITS = {
  A: 'kN/t',
  B: 'kN/(km/h)/t',
  C: 'kN/(km/h)²/t',
} as const satisfies Record<keyof RollingResistanceCoefficients, MultiUnit>;

/**
 * Convert rolling-resistance coefficients from the API's per-weight SI units
 * to the per-ton units displayed in the frontend.
 *
 * N/kg and kN/t are numerically equivalent, so only the speed unit changes.
 */
export const convertRollingResistanceToDisplay = ({
  A,
  B,
  C,
}: RollingResistanceCoefficients): RollingResistanceCoefficients => ({
  A,
  B: B / METERS_PER_SECOND_TO_KILOMETERS_PER_HOUR,
  C: C / METERS_PER_SECOND_TO_KILOMETERS_PER_HOUR ** 2,
});

/** Convert per-ton display values back to the API's per-weight SI units. */
export const convertRollingResistanceToApi = ({
  A,
  B,
  C,
}: RollingResistanceCoefficients): RollingResistanceCoefficients => ({
  A,
  B: B * METERS_PER_SECOND_TO_KILOMETERS_PER_HOUR,
  C: C * METERS_PER_SECOND_TO_KILOMETERS_PER_HOUR ** 2,
});

/** Round a coefficient for display without modifying the underlying value. */
export const formatRollingResistance = (value: number) => Number(value.toFixed(6));
