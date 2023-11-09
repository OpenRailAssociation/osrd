import { EffortCurves } from 'common/api/osrdEditoastApi';
import { checkRollingStockFormValidity, makeEffortCurve } from '../utils';
import type { RollingStockParametersValues } from '../../consts';

describe('checkRollingStockFormValidity', () => {
  describe('Non electric stock', () => {
    it('should return invalids fields with the default values', () => {
      const effortCurves: EffortCurves = {
        default_mode: 'thermal',
        modes: {},
      };
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
      const effortCurves: EffortCurves = {
        default_mode: '15000',
        modes: {
          '15000': makeEffortCurve('15000'),
        },
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
