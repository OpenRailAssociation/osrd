import type { TFunction } from 'i18next';
import { floor } from 'lodash';
import { describe, it, expect } from 'vitest';

import type { EffortCurves } from 'common/api/osrdEditoastApi';
import type { InputGroupSNCFValue } from 'common/BootstrapSNCF/InputGroupSNCF';
import {
  checkRollingStockFormValidity,
  convertUnits,
  convertUnitsWithMass,
  handleUnitValue,
  makeEffortCurve,
} from 'modules/rollingStock/helpers/utils';
import type {
  EffortCurveForms,
  MultiUnit,
  MultiUnitsParameter,
  RollingStockParametersValues,
} from 'modules/rollingStock/types';

function setupEffortCurve(tractionMode: string, max_efforts: number[], speeds: number[]) {
  const curves = makeEffortCurve(tractionMode);
  curves.curves[0].curve.max_efforts = max_efforts;
  curves.curves[0].curve.speeds = speeds;
  return curves;
}
const tMock = ((key: string) => key) as TFunction;

describe('checkRollingStockFormValidity', () => {
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
          'gammaValue',
          'inertiaCoefficient',
          'rollingResistanceA',
          'rollingResistanceB',
          'rollingResistanceC',
        ],
        validRollingStockForm: {
          name: 'auietsrn',
          length: 1,
          mass: { unit: 't', value: 155 },
          maxSpeed: { unit: 'km/h', value: 100 },
          startupAcceleration: 0,
          comfortAcceleration: 0,
          startupTime: 0,
          gammaValue: 0.01,
          inertiaCoefficient: 1,
          rollingResistanceA: { max: 20, min: 0, unit: 'kN', value: 0 },
          rollingResistanceB: { max: 0.5, min: 0, unit: 'kN/(km/h)', value: 0 },
          rollingResistanceC: { max: 0.01, min: 0, unit: 'kN/(km/h)²', value: 0 },
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
          length: 1,
          mass: { unit: 't', value: 155 },
          maxSpeed: { unit: 'km/h', value: 100 },
          startupAcceleration: 0,
          comfortAcceleration: 0,
          startupTime: 0,
          gammaValue: 0.01,
          inertiaCoefficient: 1,
          rollingResistanceA: { max: 20, min: 0, unit: 'kN', value: 0 },
          rollingResistanceB: { max: 0.5, min: 0, unit: 'kN/(km/h)', value: 0 },
          rollingResistanceC: { max: 0.01, min: 0, unit: 'kN/(km/h)²', value: 0 },
          loadingGauge: 'G1',
          electricalPowerStartupTime: 0,
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
        length: 1,
        mass: { unit: 't', value: 155 },
        maxSpeed: { unit: 'km/h', value: 100 },
        startupAcceleration: 0,
        comfortAcceleration: 0,
        startupTime: 0,
        gammaValue: 0.01,
        inertiaCoefficient: 1,
        rollingResistanceA: { max: 20, min: 0, unit: 'kN', value: 0 },
        rollingResistanceB: { max: 0.5, min: 0, unit: 'kN/(km/h)', value: 0 },
        rollingResistanceC: { max: 0.01, min: 0, unit: 'kN/(km/h)²', value: 0 },
        loadingGauge: 'G1',
        electricalPowerStartupTime: 0,
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

describe('multi units parameter conversion', () => {
  describe('unit converter', () => {
    it('should convert kg to t', () => {
      const convertedUnit = convertUnits('kg', 't', 1000);
      expect(convertedUnit).toEqual(1);
    });
    it('should convert t to kg', () => {
      const convertedUnit = convertUnits('t', 'kg', 15);
      expect(convertedUnit).toEqual(15000);
    });
    it('should convert km/h to m/s', () => {
      const convertedUnit = convertUnits('km/h', 'm/s', 150);
      expect(floor(convertedUnit, 1)).toEqual(41.6);
    });
    it('should convert m/s to km/h', () => {
      const convertedUnit = convertUnits('m/s', 'km/h', 50);
      expect(convertedUnit).toEqual(180);
    });
    it('should convert N to kN', () => {
      const convertedUnit = convertUnits('N', 'kN', 10000);
      expect(convertedUnit).toEqual(10);
    });
    it('should convert kN to N', () => {
      const convertedUnit = convertUnits('kN', 'N', 10);
      expect(convertedUnit).toEqual(10000);
    });
    it('should convert N/(m/s) to N/(km/h)', () => {
      const convertedUnit = convertUnits('N/(m/s)', 'N/(km/h)', 36);
      expect(convertedUnit).toEqual(10);
    });
    it('should convert N/(m/s) to kN/(km/h)', () => {
      const convertedUnit = convertUnits('N/(m/s)', 'kN/(km/h)', 36);
      expect(convertedUnit).toEqual(0.01);
    });
    it('should convert N/(km/h) to N/(m/s)', () => {
      const convertedUnit = convertUnits('N/(km/h)', 'N/(m/s)', 150);
      expect(convertedUnit).toEqual(540);
    });
    it('should convert N/(km/h) to kN/(km/h)', () => {
      const convertedUnit = convertUnits('N/(km/h)', 'kN/(km/h)', 150);
      expect(convertedUnit).toEqual(0.15);
    });
    it('should convert kN/(km/h) to N/(m/s)', () => {
      const convertedUnit = convertUnits('kN/(km/h)', 'N/(m/s)', 15);
      expect(convertedUnit).toEqual(54000);
    });
    it('should convert kN/(km/h) to N/(km/h)', () => {
      const convertedUnit = convertUnits('kN/(km/h)', 'N/(km/h)', 15);
      expect(convertedUnit).toEqual(15000);
    });
    it('should convert N/(m/s)² to N/(km/h)²', () => {
      const convertedUnit = convertUnits('N/(m/s)²', 'N/(km/h)²', 55);
      expect(floor(convertedUnit, 1)).toEqual(4.2);
    });
    it('should convert N/(m/s)² to kN/(km/h)²', () => {
      const convertedUnit = convertUnits('N/(m/s)²', 'kN/(km/h)²', 55);
      expect(floor(convertedUnit, 3)).toEqual(0.004);
    });
    it('should convert N/(km/h)² to N/(m/s)²', () => {
      const convertedUnit = convertUnits('N/(km/h)²', 'N/(m/s)²', 2);
      expect(convertedUnit).toEqual(25.92);
    });
    it('should convert N/(km/h)² to kN/(km/h)²', () => {
      const convertedUnit = convertUnits('N/(km/h)²', 'kN/(km/h)²', 2);
      expect(floor(convertedUnit, 3)).toEqual(0.002);
    });
    it('should convert kN/(km/h)² to N/(m/s)²', () => {
      const convertedUnit = convertUnits('kN/(km/h)²', 'N/(m/s)²', 0.007);
      expect(convertedUnit).toEqual(90.72);
    });
    it('should convert kN/(km/h)² to N/(km/h)²', () => {
      const convertedUnit = convertUnits('kN/(km/h)²', 'N/(km/h)²', 0.007);
      expect(convertedUnit).toEqual(7);
    });
  });
  describe('mass converter', () => {
    it('should divide the unit value by mass with current mass in t', () => {
      const convertedValue = convertUnitsWithMass('kN', 'kN/t', 40, 't', 20);
      expect(convertedValue).toEqual(0.5);
    });
    it('should divide the unit value by mass with current mass in kg', () => {
      const convertedValue = convertUnitsWithMass('kN', 'kN/t', 40000, 'kg', 20);
      expect(convertedValue).toEqual(0.5);
    });
    it('should multiply the unit value by mass with current mass in t', () => {
      const convertedValue = convertUnitsWithMass('kN/t', 'kN', 40, 't', 0.5);
      expect(convertedValue).toEqual(20);
    });
    it('should multiply the unit value by mass with current mass in kg', () => {
      const convertedValue = convertUnitsWithMass('kN/t', 'kN', 40000, 'kg', 0.5);
      expect(convertedValue).toEqual(20);
    });
  });
  describe('parameter unit convertor', () => {
    const values: InputGroupSNCFValue<MultiUnit>[] = [
      {
        unit: 'kg',
        value: undefined,
      },
      {
        unit: 'km/h',
        value: 200,
      },
      {
        unit: 'N/(km/h)',
        value: 0,
      },
      {
        unit: 'kN/t',
        value: 15000,
      },
    ];
    const multiUnitsParams: Record<string, MultiUnitsParameter> = {
      mass: {
        min: 0.1,
        max: 10000,
        unit: 't',
        value: 100,
      },
      maxSpeed: {
        min: 1,
        max: 600,
        unit: 'km/h',
        value: 200,
      },
      rollingResistanceB: {
        min: 0,
        max: 1800,
        unit: 'N/(m/s)',
        value: 0,
      },
      rollingResistanceA: {
        min: 0,
        max: 20000,
        unit: 'N',
        value: 15000,
      },
    };
    it("should return undefined if it converts a param value and the option's value is undefined", () => {
      const convertedValue = handleUnitValue(
        values[0],
        multiUnitsParams.mass,
        multiUnitsParams.mass
      );
      expect(convertedValue).toEqual(undefined);
    });
    it("should return the same option value if option's unit is the same as the param's current unit", () => {
      const convertedMinValue = handleUnitValue(
        values[1],
        multiUnitsParams.maxSpeed,
        multiUnitsParams.mass,
        'min'
      );
      expect(convertedMinValue).toEqual(convertedMinValue);
    });
    it("should return the same option value if option's unit equals 0", () => {
      const convertedValue = handleUnitValue(
        values[2],
        multiUnitsParams.rollingResistanceB,
        multiUnitsParams.mass
      );
      expect(convertedValue).toEqual(convertedValue);
    });
    it("should properly convert the unit's value if units are different and there is an option value", () => {
      const convertedMinValue = handleUnitValue(
        values[0],
        multiUnitsParams.mass,
        multiUnitsParams.mass,
        'min'
      );
      expect(convertedMinValue).toEqual(100);
    });
    it("should properly convert the unit's value with the mass convertor if one of the units ends with 't' and is not the mass parameter", () => {
      const convertedValue = handleUnitValue(
        values[3],
        multiUnitsParams.rollingResistanceA,
        multiUnitsParams.mass
      );
      expect(convertedValue).toEqual(0.15);
    });
  });
});
