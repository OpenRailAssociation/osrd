import { describe, it, expect } from 'vitest';

import { getRollingStockEditorDefaultValues, getDefaultRollingStockMode } from '../defaultValues';
import { modifyRollingStockElectricalValues, orderElectricalProfils } from '../electricalValues';

describe('orderElectricalProfils', () => {
  it('should order the list of electrical profiles', () => {
    const result = orderElectricalProfils(['B', 'C', 'A', null, 'O'], '1500V');
    const expected = [null, 'O', 'A', 'B', 'C'];

    expect(result).toEqual(expected);
  });
});

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
