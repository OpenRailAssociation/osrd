import { describe, expect, it } from 'vitest';

import {
  convertRollingResistanceToApi,
  convertRollingResistanceToDisplay,
  formatRollingResistance,
} from '../rollingResistance';

describe('rolling resistance conversions', () => {
  const apiRollingResistance = {
    A: 0.011894736842105,
    B: 0.000341052631579,
    C: 0.000027284210526,
  };

  it('converts API per-weight SI coefficients to the displayed per-ton units', () => {
    const displayRollingResistance = convertRollingResistanceToDisplay(apiRollingResistance);

    expect(displayRollingResistance.A).toBe(apiRollingResistance.A);
    expect(displayRollingResistance.B).toBeCloseTo(0.000094736842105, 15);
    expect(displayRollingResistance.C).toBeCloseTo(0.000002105263158, 15);
  });

  it('round-trips displayed coefficients without losing their underlying precision', () => {
    const displayRollingResistance = convertRollingResistanceToDisplay(apiRollingResistance);

    expect(convertRollingResistanceToApi(displayRollingResistance)).toEqual(apiRollingResistance);
  });

  it('rounds values to six decimal places for display', () => {
    expect(formatRollingResistance(apiRollingResistance.A)).toBe(0.011895);
    expect(formatRollingResistance(apiRollingResistance.B / 3.6)).toBe(0.000095);
    expect(formatRollingResistance(apiRollingResistance.C / 3.6 ** 2)).toBe(0.000002);
  });
});
