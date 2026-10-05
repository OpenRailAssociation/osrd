import { describe, expect, it } from 'vitest';

import type {
  EffortCurveForms,
  RollingStockParametersValidValues,
} from 'applications/rollingStockEditor/types';

import { rollingStockEditorQueryArg } from '../utils';

const effortCurves: EffortCurveForms = {
  thermal: {
    curves: [
      {
        cond: {
          comfort: 'STANDARD',
          electrical_profile_level: null,
          power_restriction_code: null,
        },
        curve: {
          max_efforts: [0, 1],
          speeds: [0, 1],
        },
      },
    ],
    default_curve: {
      max_efforts: [0, 1],
      speeds: [0, 1],
    },
    is_electric: false,
  },
};

const rollingStockValues: RollingStockParametersValidValues = {
  railjsonVersion: '3.3',
  name: 'test rolling stock',
  detail: '',
  family: '',
  grouping: '',
  number: '',
  reference: '',
  series: '',
  subseries: '',
  type: '',
  unit: '',
  length: 100,
  mass: { min: 0.1, max: 10_000, unit: 't', value: 80 },
  maxSpeed: { min: 1, max: 600, unit: 'km/h', value: 160 },
  startupTime: 1,
  startupAcceleration: 0.1,
  comfortAcceleration: 0.2,
  constGamma: 0.5,
  inertiaCoefficient: 1.1,
  loadingGauge: 'G1',
  rollingResistanceA: { min: 0, max: 20, unit: 'kN/t', value: 0.011895 },
  rollingResistanceB: {
    min: 0,
    max: 0.5,
    unit: 'kN/(km/h)/t',
    value: 0.000095,
  },
  rollingResistanceC: {
    min: 0,
    max: 0.01,
    unit: 'kN/(km/h)²/t',
    value: 0.000002,
  },
  electricalPowerStartupTime: null,
  raisePantographTime: null,
  basePowerClass: null,
  powerRestrictions: {},
  supportedSignalingSystems: [],
  primaryCategory: 'FREIGHT_TRAIN',
  categories: new Set(['FREIGHT_TRAIN']),
};

describe('rollingStockEditorQueryArg', () => {
  it('converts per-ton display coefficients to API per-weight SI units', () => {
    const payload = rollingStockEditorQueryArg(rollingStockValues, effortCurves);

    expect(payload.rolling_resistance.A).toBe(0.011895);
    expect(payload.rolling_resistance.B).toBeCloseTo(0.000342, 15);
    expect(payload.rolling_resistance.C).toBeCloseTo(0.00002592, 15);
  });

  it('normalizes absolute coefficient units by mass before building the payload', () => {
    const payload = rollingStockEditorQueryArg(
      {
        ...rollingStockValues,
        rollingResistanceA: { min: 0, max: 20, unit: 'kN', value: 15 },
        rollingResistanceB: {
          min: 0,
          max: 0.5,
          unit: 'kN/(km/h)',
          value: 0.3,
        },
        rollingResistanceC: {
          min: 0,
          max: 0.01,
          unit: 'kN/(km/h)²',
          value: 0.005,
        },
      },
      effortCurves
    );

    expect(payload.rolling_resistance.A).toBe(0.1875);
    expect(payload.rolling_resistance.B).toBeCloseTo(0.0135, 15);
    expect(payload.rolling_resistance.C).toBeCloseTo(0.00081, 15);
  });
});
