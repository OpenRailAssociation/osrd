import { checkRollingStockFormValidity, makeEffortCurve } from 'modules/rollingStock/helpers/utils';

import type { EffortCurves } from 'common/api/osrdEditoastApi';
import type { EffortCurveForms, RollingStockParametersValues } from 'modules/rollingStock/types';
import { TFunction } from 'i18next';

function setupEffortCurve(tractionMode: string, max_efforts: number[], speeds: number[]) {
  const curves = makeEffortCurve(tractionMode);
  curves.curves[0].curve.max_efforts = max_efforts;
  curves.curves[0].curve.speeds = speeds;
  return curves;
}
const tMock: TFunction = (key: string) => key;

describe('checkRollingStockFormValidity', () => {
  describe('Non electric stock', () => {
    it('should return invalid fields with the default values', () => {
      const effortCurves: EffortCurves['modes'] = {};
      const rsForm = {
        name: 'auietsrn',
        mass: 155,
        maxSpeed: 10000,
      } as RollingStockParametersValues;

      const expected = {
        invalidFields: [
          'length',
          'startupAcceleration',
          'comfortAcceleration',
          'startupTime',
          'gammaValue',
          'inertiaCoefficient',
          'rollingResistanceA',
          'rollingResistanceB',
          'rollingResistanceC',
        ],
        validRollingStockForm: {
          name: 'auietsrn',
          length: 0,
          mass: 155,
          maxSpeed: 10000,
          startupAcceleration: 0,
          comfortAcceleration: 0.01,
          startupTime: 0,
          gammaValue: 0.01,
          inertiaCoefficient: 1,
          rollingResistanceA: 0,
          rollingResistanceB: 0,
          rollingResistanceC: 0,
        },
        invalidEffortCurves: [],
      };
      const result = checkRollingStockFormValidity(rsForm, effortCurves, tMock);
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
        mass: 155,
        maxSpeed: 10000,
        loadingGauge: 'G1',
        basePowerClass: null,
      } as RollingStockParametersValues;

      const expected = {
        invalidFields: [
          'length',
          'startupAcceleration',
          'comfortAcceleration',
          'startupTime',
          'gammaValue',
          'inertiaCoefficient',
          'rollingResistanceA',
          'rollingResistanceB',
          'rollingResistanceC',
          'electricalPowerStartupTime',
          'raisePantographTime',
        ],
        validRollingStockForm: {
          name: 'auietsrn',
          length: 0,
          mass: 155,
          maxSpeed: 10000,
          startupAcceleration: 0,
          comfortAcceleration: 0.01,
          startupTime: 0,
          gammaValue: 0.01,
          inertiaCoefficient: 1,
          rollingResistanceA: 0,
          rollingResistanceB: 0,
          rollingResistanceC: 0,
          loadingGauge: 'G1',
          electricalPowerStartupTime: 5,
          raisePantographTime: 15,
          basePowerClass: null,
        },
        invalidEffortCurves: ['comfortTypes.STANDARD > 15000 > unspecified > unspecified'],
      };
      const result = checkRollingStockFormValidity(rsForm, effortCurves, tMock);
      expect(result).toEqual(expected);
    });
  });
  describe('Invalid curve', () => {
    const rsForm = {
      name: 'auietsrn',
      mass: 155,
      maxSpeed: 10000,
      loadingGauge: 'G1',
      basePowerClass: null,
    } as RollingStockParametersValues;
    const expected = {
      invalidFields: [
        'length',
        'startupAcceleration',
        'comfortAcceleration',
        'startupTime',
        'gammaValue',
        'inertiaCoefficient',
        'rollingResistanceA',
        'rollingResistanceB',
        'rollingResistanceC',
        'electricalPowerStartupTime',
        'raisePantographTime',
      ],
      validRollingStockForm: {
        name: 'auietsrn',
        length: 0,
        mass: 155,
        maxSpeed: 10000,
        startupAcceleration: 0,
        comfortAcceleration: 0.01,
        startupTime: 0,
        gammaValue: 0.01,
        inertiaCoefficient: 1,
        rollingResistanceA: 0,
        rollingResistanceB: 0,
        rollingResistanceC: 0,
        loadingGauge: 'G1',
        electricalPowerStartupTime: 5,
        raisePantographTime: 15,
        basePowerClass: null,
      },
      invalidEffortCurves: [],
    };
    it('should return invalidEffortCurves as true when any curve contains fewer than two values', () => {
      const effortCurves: EffortCurveForms = {
        '15000': setupEffortCurve('1500', [1], [10]),
        '1000': setupEffortCurve('1000', [3, 4, 3], [30, 40, 50]),
      };

      const result = checkRollingStockFormValidity(rsForm, effortCurves, tMock);
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

      const result = checkRollingStockFormValidity(rsForm, effortCurves, tMock);
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

      const result = checkRollingStockFormValidity(rsForm, effortCurves, tMock);
      expect(result).toEqual(expected);
    });
  });
});
