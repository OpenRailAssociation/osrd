import { describe, it, expect } from 'vitest';

import type { RollingStock } from 'common/api/osrdEditoastApi';

import { getSupportedElectrification } from '../electric';

describe('electric helpers', () => {
  it('should return only supported electrifications', () => {
    const mockedCurves: RollingStock['effort_curves']['modes'] = {
      '1500V': {
        curves: [],
        default_curve: { speeds: [], max_efforts: [] },
        is_electric: true,
      },
      '15000V': {
        curves: [],
        default_curve: { speeds: [], max_efforts: [] },
        is_electric: true,
      },
      thermal: {
        curves: [],
        default_curve: { speeds: [], max_efforts: [] },
        is_electric: false,
      },
    };

    expect(getSupportedElectrification(mockedCurves)).toEqual(['1500V', '15000V']);
  });
});
