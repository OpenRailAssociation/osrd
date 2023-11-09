import {
  getDefaultRollingStockMode,
  getRollingStockEditorDefaultValues,
} from 'modules/rollingStock/helpers/utils';
import { modifyRollingStockElectricalValues } from '../RollingStockEditorForm';

const newEmptyRollingStock = getRollingStockEditorDefaultValues(null);
const rsEffortCurve1000 = getDefaultRollingStockMode('1000');
const rsEffortCurveThermal = getDefaultRollingStockMode('thermal');

describe('getElectricalDefaultValues', () => {
  it('should remove the electricalPowerStartupTime and raisePantographTime values if we previously had an electrical and it was removed', () => {
    const currentRollingStockValues = {
      ...newEmptyRollingStock,
      electricalPowerStartupTime: 123,
      raisePantographTime: 456,
    };
    const rsEffortCurve = {
      ...rsEffortCurve1000,
      modes: {},
    };
    const result = modifyRollingStockElectricalValues(currentRollingStockValues, rsEffortCurve);
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
