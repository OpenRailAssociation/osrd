import { checkRollingStockFormValidity, makeEffortCurve } from 'modules/rollingStock/helpers/utils';

import type { EffortCurves } from 'common/api/osrdEditoastApi';
import type { EffortCurveForms, RollingStockParametersValues } from 'modules/rollingStock/types';

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
      };
      const result = checkRollingStockFormValidity(rsForm, effortCurves);
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
      };
      const result = checkRollingStockFormValidity(rsForm, effortCurves);
      expect(result).toEqual(expected);
    });
  });
});
