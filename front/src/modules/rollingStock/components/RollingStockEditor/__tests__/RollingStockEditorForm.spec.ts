import { describe, it, expect } from 'vitest';

import {
  getDefaultRollingStockMode,
  getRollingStockEditorDefaultValues,
} from 'modules/rollingStock/helpers/utils';

import { modifyRollingStockElectricalValues } from '../RollingStockEditorForm';

const newEmptyRollingStock = getRollingStockEditorDefaultValues();
const rsEffortCurve1000 = getDefaultRollingStockMode('1000');
const rsEffortCurveThermal = getDefaultRollingStockMode('thermal');

describe('modifyRollingStockElectricalValues', () => {
  it('should remove the electricalPowerStartupTime and raisePantographTime values if we previously had an electrical and it was removed', () => {
    const currentRollingStockValues = {
      ...newEmptyRollingStock,
      electricalPowerStartupTime: 123,
      raisePantographTime: 456,
    };
    const emptyEffortCurves = {};
    const result = modifyRollingStockElectricalValues(currentRollingStockValues, emptyEffortCurves);
    const expected = {
      ...newEmptyRollingStock,
      electricalPowerStartupTime: null,
      raisePantographTime: null,
    };
    expect(result).toEqual(expected);
  });

  it('should NOT do anything otherwise (electric)', () => {
    const rsEffortCurve = rsEffortCurve1000;
    const result = modifyRollingStockElectricalValues(newEmptyRollingStock, rsEffortCurve);
    expect(result).toEqual(newEmptyRollingStock);
  });

  it('should NOT do anything otherwise (thermal)', () => {
    const rsEffortCurve = rsEffortCurveThermal;
    const result = modifyRollingStockElectricalValues(newEmptyRollingStock, rsEffortCurve);
    expect(result).toEqual(newEmptyRollingStock);
  });
});
