import { describe, it, expect } from 'vitest';

import { computeFilter, type RollingStockFilters } from '../useFilterRollingStock';

describe('computeFilter', () => {
  const initialFilters: RollingStockFilters = {
    text: '',
    elec: false,
    thermal: false,
    locked: false,
    notLocked: false,
  };

  it('should toggle the filter value', () => {
    const filters = { ...initialFilters };

    let result = computeFilter('elec', filters);
    expect(result).toEqual({ ...filters, elec: true });

    result = computeFilter('thermal', filters);
    expect(result).toEqual({ ...filters, thermal: true });
  });

  it('should set "notLocked" to true and "locked" to false if the filter is "notLocked" and "locked" is true', () => {
    const filter = 'notLocked';
    const filters = { ...initialFilters, locked: true };

    const result = computeFilter(filter, filters);

    expect(result).toEqual({ ...filters, locked: false, notLocked: true });
  });

  it('should set "locked" to true and "notLocked" to false if the filter is "locked" and "notLocked" is true', () => {
    const filter = 'locked';
    const filters = { ...initialFilters, notLocked: true };

    const result = computeFilter(filter, filters);

    expect(result).toEqual({ ...filters, locked: true, notLocked: false });
  });
});
