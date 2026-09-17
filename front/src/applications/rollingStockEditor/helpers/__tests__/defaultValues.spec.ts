import { describe, expect, it } from 'vitest';

import type { RollingStock } from 'common/api/osrdEditoastApi';

import { getRollingStockEditorDefaultValues } from '../defaultValues';

describe('getRollingStockEditorDefaultValues', () => {
  it('loads API rolling-resistance coefficients in per-ton display units', () => {
    const rollingStock: RollingStock = {
      railjson_version: '3.3',
      name: 'test rolling stock',
      metadata: null,
      id: 1,
      locked: false,
      version: 1,
      length: 100,
      mass: 80_000,
      max_speed: 50,
      startup_time: 1,
      startup_acceleration: 0.1,
      comfort_acceleration: 0.2,
      const_gamma: 0.5,
      inertia_coefficient: 1.1,
      loading_gauge: 'G1',
      effort_curves: {
        default_mode: 'thermal',
        modes: {},
      },
      rolling_resistance: {
        type: 'davis',
        A: 0.011894736842105,
        B: 0.000341052631579,
        C: 0.000027284210526,
      },
      electrical_power_startup_time: null,
      raise_pantograph_time: null,
      base_power_class: null,
      power_restrictions: {},
      energy_sources: [],
      supported_signaling_systems: [],
      primary_category: 'FREIGHT_TRAIN',
      other_categories: [],
    };

    const values = getRollingStockEditorDefaultValues(rollingStock);

    expect(values.rollingResistanceA).toMatchObject({
      unit: 'kN/t',
      value: rollingStock.rolling_resistance.A,
    });
    expect(values.rollingResistanceB?.unit).toBe('kN/(km/h)/t');
    expect(values.rollingResistanceB?.value).toBeCloseTo(0.000094736842105, 15);
    expect(values.rollingResistanceC?.unit).toBe('kN/(km/h)²/t');
    expect(values.rollingResistanceC?.value).toBeCloseTo(0.000002105263158, 15);
  });
});
