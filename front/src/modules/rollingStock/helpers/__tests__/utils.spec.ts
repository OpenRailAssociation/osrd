import {
  checkRollingStockFormValidity,
  convertUnit,
  makeEffortCurve,
} from 'modules/rollingStock/helpers/utils';

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

describe('convert units', () => {
  it('should convert weight units from tons to kilograms', () => {
    expect(convertUnit(4, 't', 'kg')).toBe(4000);
  });
  it('should convert weight units from kilograms to tons', () => {
    expect(convertUnit(4, 'kg', 't')).toBe(0.004);
  });
  it('should convert weight units from kN to daN', () => {
    expect(convertUnit(5, 'kN', 'daN')).toBe(500);
  });
  it('should convert speed units from km/h to m/s', () =>
    expect(convertUnit(1000, 'km/h', 'm/s')).toBe(1000 / 3.6));
  it('should throw error for non existing old unit', () =>
    expect(convertUnit(1000, 'potatoes', 'm/s')).toThrowError());
  it('should throw error for non existing new unit', () =>
    expect(convertUnit(1000, 't', 'm/s')).toThrowError());
});
