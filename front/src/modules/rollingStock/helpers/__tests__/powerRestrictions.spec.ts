import { describe, it, expect } from 'vitest';

import { effortCurves } from 'modules/powerRestriction/helpers/__tests__/sampleData';

import { getRollingStockPowerRestrictionsByMode } from '../powerRestrictions';

const powerRestrictionsByMode = {
  '1500V': ['code1', 'code2'],
  '25000V': ['code3', 'code4'],
};

describe('getRollingStockPowerRestrictionsByMode', () => {
  it('should properly format power restrictions by electrification mode without duplicate', () => {
    const result = getRollingStockPowerRestrictionsByMode(effortCurves);

    expect(result).toEqual(powerRestrictionsByMode);
  });
});
