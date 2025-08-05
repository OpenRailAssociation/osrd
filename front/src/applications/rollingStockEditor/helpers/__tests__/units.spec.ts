import { describe, it, expect } from 'vitest';

import type { InputGroupSNCFValue } from 'common/BootstrapSNCF/InputGroupSNCF';
import type { MultiUnit, MultiUnitsParameter } from 'modules/rollingStock/types';

import {
  convertUnitsWithMass,
  handleUnitValue,
  isMassDependentUnit,
  rescaleMassDependentParam,
} from '../units';

describe('convertUnitsWithMass', () => {
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

describe('handleUnitValue', () => {
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
    const convertedValue = handleUnitValue(values[0], multiUnitsParams.mass, multiUnitsParams.mass);
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

describe('isMassDependentUnit', () => {
  it('should return true for a mass dependent unit like "kN/t"', () => {
    expect(isMassDependentUnit('kN/t')).toBe(true);
  });

  it('should return false for a non-mass dependent unit like "kN"', () => {
    expect(isMassDependentUnit('kN')).toBe(false);
  });

  it('should return false for null or undefined', () => {
    expect(isMassDependentUnit(undefined)).toBe(false);
  });

  it('should return false for tons themselves', () => {
    expect(isMassDependentUnit('t')).toBe(false);
  });
});

describe('updateMassDependentParam', () => {
  it('should update min and max based on new mass values with different units', () => {
    const previousMass: MultiUnitsParameter = { value: 20000, unit: 'kg', min: 0, max: 0 };
    const newMass: MultiUnitsParameter = { value: 10, unit: 't', min: 0, max: 0 };
    const param: MultiUnitsParameter = { unit: 'kN/t', value: 1, min: 0.1, max: 2 };

    const updated = rescaleMassDependentParam(param, previousMass, newMass);
    expect(updated.min).toBeCloseTo(0.2, 10);
    expect(updated.max).toBeCloseTo(4, 10);
    expect(updated.value).toEqual(1);
    expect(updated.unit).toEqual('kN/t');
  });

  it('should update min and max based on new mass values with the same unit', () => {
    const previousMass: MultiUnitsParameter = { value: 5, unit: 't', min: 0, max: 0 };
    const newMass: MultiUnitsParameter = { value: 10, unit: 't', min: 0, max: 0 };
    const param: MultiUnitsParameter = { unit: 'kN/t', value: 2, min: 0.1, max: 2 };

    const updated = rescaleMassDependentParam(param, previousMass, newMass);
    expect(updated.min).toBeCloseTo(0.05, 10);
    expect(updated.max).toBeCloseTo(1, 10);
    expect(updated.value).toEqual(2); // This value thus becomes out of the defined range
    expect(updated.unit).toEqual('kN/t');
  });
});
