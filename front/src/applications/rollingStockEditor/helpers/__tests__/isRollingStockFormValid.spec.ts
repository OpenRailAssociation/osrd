import type { TFunction } from 'i18next';
import { describe, it, expect } from 'vitest';

import type {
  RollingStockParametersValues,
  EffortCurveForms,
} from 'applications/rollingStockEditor/types';
import type { EffortCurves } from 'common/api/osrdEditoastApi';

import { makeEffortCurve } from '../defaultValues';
import isRollingStockFormValid from '../isRollingStockFormValid';

function setupEffortCurve(tractionMode: string, max_efforts: number[], speeds: number[]) {
  const curves = makeEffortCurve(tractionMode);
  curves.curves[0].curve.max_efforts = max_efforts;
  curves.curves[0].curve.speeds = speeds;
  return curves;
}
const tMock = ((key: string) => key) as TFunction;

describe('isRollingStockFormValid', () => {
  describe('Non electric stock', () => {
    it('should return invalid fields with the default values', () => {
      const effortCurves: EffortCurves['modes'] = {};
      const rsForm = {
        name: 'auietsrn',
        mass: { unit: 't', value: 155 },
        maxSpeed: { unit: 'km/h', value: 100 },
      } as RollingStockParametersValues;

      const expected = {
        invalidFields: [
          'length',
          'startupAcceleration',
          'comfortAcceleration',
          'startupTime',
          'constGamma',
          'inertiaCoefficient',
          'rollingResistanceA',
          'rollingResistanceB',
          'rollingResistanceC',
          'primaryCategory',
        ],
        validRollingStockForm: {
          name: 'auietsrn',
          length: 1,
          mass: { unit: 't', value: 155 },
          maxSpeed: { unit: 'km/h', value: 100 },
          startupAcceleration: 0,
          comfortAcceleration: 0,
          startupTime: 0,
          constGamma: 0.01,
          inertiaCoefficient: 1,
          rollingResistanceA: { max: 20, min: 0, unit: 'kN', value: 0 },
          rollingResistanceB: { max: 0.5, min: 0, unit: 'kN/(km/h)', value: 0 },
          rollingResistanceC: { max: 0.01, min: 0, unit: 'kN/(km/h)²', value: 0 },
          primaryCategory: 'FREIGHT_TRAIN',
        },
        invalidEffortCurves: [],
      };
      const result = isRollingStockFormValid(rsForm, effortCurves, tMock);
      expect(result).toEqual(expected);
    });
  });
  describe('Electric stock', () => {
    it('should return electricalPowerStartupTime and raisePantographTime', () => {
      const effortCurves: EffortCurveForms = {
        '15000': makeEffortCurve('15000'),
      };
      const rsForm = {
        name: 'auietsrn',
        mass: { unit: 't', value: 155 },
        maxSpeed: { unit: 'km/h', value: 100 },
        loadingGauge: 'G1',
        basePowerClass: null,
        primaryCategory: 'FAST_FREIGHT_TRAIN',
      } as RollingStockParametersValues;

      const expected = {
        invalidFields: [
          'length',
          'startupAcceleration',
          'comfortAcceleration',
          'startupTime',
          'constGamma',
          'inertiaCoefficient',
          'rollingResistanceA',
          'rollingResistanceB',
          'rollingResistanceC',
          'electricalPowerStartupTime',
          'raisePantographTime',
        ],
        validRollingStockForm: {
          name: 'auietsrn',
          length: 1,
          mass: { unit: 't', value: 155 },
          maxSpeed: { unit: 'km/h', value: 100 },
          startupAcceleration: 0,
          comfortAcceleration: 0,
          startupTime: 0,
          constGamma: 0.01,
          inertiaCoefficient: 1,
          rollingResistanceA: { max: 20, min: 0, unit: 'kN', value: 0 },
          rollingResistanceB: { max: 0.5, min: 0, unit: 'kN/(km/h)', value: 0 },
          rollingResistanceC: { max: 0.01, min: 0, unit: 'kN/(km/h)²', value: 0 },
          loadingGauge: 'G1',
          electricalPowerStartupTime: 0,
          raisePantographTime: 15,
          basePowerClass: null,
          primaryCategory: 'FAST_FREIGHT_TRAIN',
        },
        invalidEffortCurves: ['comfortTypes.STANDARD > 15000 > unspecified > unspecified'],
      };
      const result = isRollingStockFormValid(rsForm, effortCurves, tMock);
      expect(result).toEqual(expected);
    });
  });
  describe('Invalid curve', () => {
    const rsForm = {
      name: 'auietsrn',
      mass: { unit: 't', value: 155 },
      maxSpeed: { unit: 'km/h', value: 100 },
      loadingGauge: 'G1',
      basePowerClass: null,
    } as RollingStockParametersValues;
    const expected = {
      invalidFields: [
        'length',
        'startupAcceleration',
        'comfortAcceleration',
        'startupTime',
        'constGamma',
        'inertiaCoefficient',
        'rollingResistanceA',
        'rollingResistanceB',
        'rollingResistanceC',
        'electricalPowerStartupTime',
        'raisePantographTime',
        'primaryCategory',
      ],
      validRollingStockForm: {
        name: 'auietsrn',
        length: 1,
        mass: { unit: 't', value: 155 },
        maxSpeed: { unit: 'km/h', value: 100 },
        startupAcceleration: 0,
        comfortAcceleration: 0,
        startupTime: 0,
        constGamma: 0.01,
        inertiaCoefficient: 1,
        rollingResistanceA: { max: 20, min: 0, unit: 'kN', value: 0 },
        rollingResistanceB: { max: 0.5, min: 0, unit: 'kN/(km/h)', value: 0 },
        rollingResistanceC: { max: 0.01, min: 0, unit: 'kN/(km/h)²', value: 0 },
        loadingGauge: 'G1',
        electricalPowerStartupTime: 0,
        raisePantographTime: 15,
        basePowerClass: null,
        primaryCategory: 'FREIGHT_TRAIN',
      },
      invalidEffortCurves: [],
    };
    it('should return invalidEffortCurves as true when any curve contains fewer than two values', () => {
      const effortCurves: EffortCurveForms = {
        '15000': setupEffortCurve('1500', [1], [10]),
        '1000': setupEffortCurve('1000', [3, 4, 3], [30, 40, 50]),
      };

      const result = isRollingStockFormValid(rsForm, effortCurves, tMock);
      expect(result).toEqual({
        ...expected,
        invalidEffortCurves: ['comfortTypes.STANDARD > 15000 > unspecified > unspecified'],
      });
    });

    it('should return invalidEffortCurves as true when any curve includes duplicate speed values', () => {
      const effortCurves: EffortCurveForms = {
        '15000': setupEffortCurve('1500', [1, 2, 1], [10, 20, 10]),
        '1000': setupEffortCurve('1000', [3, 4, 3], [30, 40, 30]),
      };

      const result = isRollingStockFormValid(rsForm, effortCurves, tMock);
      expect(result).toEqual({
        ...expected,
        invalidEffortCurves: [
          'comfortTypes.STANDARD > 1000 > unspecified > unspecified',
          'comfortTypes.STANDARD > 15000 > unspecified > unspecified',
        ],
      });
    });

    it('should return invalidEffortCurves as false when all curves contain unique speed values and at least two values each', () => {
      const effortCurves: EffortCurveForms = {
        '15000': setupEffortCurve('1500', [1, 2, 1], [10, 20, 30]),
        '1000': setupEffortCurve('1000', [3, 4, 3], [30, 40, 50]),
      };

      const result = isRollingStockFormValid(rsForm, effortCurves, tMock);
      expect(result).toEqual(expected);
    });
  });
});
