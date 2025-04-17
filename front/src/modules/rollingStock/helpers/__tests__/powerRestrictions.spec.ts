import { describe, it, expect } from 'vitest';

import generateEffortCurvesForTests from 'modules/powerRestriction/helpers/__tests__/generateEffortCurvesForTests';

import { getRollingStockPowerRestrictionsByMode } from '../powerRestrictions';

const powerRestrictionsByMode = {
  '1500V': ['code1', 'code2'],
  '25000V': ['code3', 'code4'],
};

const effortCurves = generateEffortCurvesForTests({
  '1500V': [
    {
      electricalProfile: 'level1',
      powerRestrictionCode: 'code1',
    },
    {
      electricalProfile: 'level1',
      powerRestrictionCode: 'code2',
    },
    {
      electricalProfile: 'level1',
      powerRestrictionCode: 'code2',
      comfort: 'AIR_CONDITIONING',
    },
  ],
  '25000V': [
    {
      electricalProfile: 'level2',
      powerRestrictionCode: 'code3',
    },
    {
      electricalProfile: 'level2',
      powerRestrictionCode: 'code4',
    },
  ],
});

describe('getRollingStockPowerRestrictionsByMode', () => {
  it('should properly format power restrictions by electrification mode without duplicate', () => {
    const result = getRollingStockPowerRestrictionsByMode(effortCurves);

    expect(result).toEqual(powerRestrictionsByMode);
  });
});
