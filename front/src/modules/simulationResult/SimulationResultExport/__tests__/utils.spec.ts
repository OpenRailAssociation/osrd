import { describe, it, expect } from 'vitest';

import { findActualVmaxs } from '../utils';

describe('findActualVmax', () => {
  const vMax = { internalBoundaries: [2000, 3400, 5300, 6000], speeds: [10, 100, 200, 100, 150] };

  it('should return the correct Vmax when the givenPosition is in an intermediary interval', () => {
    const result = findActualVmaxs(2500, vMax);
    expect(result).toEqual([100]);
  });

  it('should return the correct Vmax when the givenPosition is in the last interval', () => {
    const result = findActualVmaxs(7000, vMax);
    expect(result).toEqual([150]);
  });

  it('should return the correct Vmax when the givenPosition is in thefirst interval', () => {
    const result = findActualVmaxs(1000, vMax);
    expect(result).toEqual([10]);
  });

  it('should return both Vmax before and after when givenPosition is equal to a boundary (min before)', () => {
    const result = findActualVmaxs(3400, vMax);
    expect(result).toEqual([100, 200]);
  });

  it('should return both Vmax before and after when givenPosition is equal to a boundary (min after)', () => {
    const result = findActualVmaxs(5300, vMax);
    expect(result).toEqual([200, 100]);
  });

  it('should return the last 2 speed values when givenPosition is equal to the last boundary', () => {
    const result = findActualVmaxs(6000, vMax);
    expect(result).toEqual([100, 150]);
  });

  it('should return the first 2 speed values when givenPosition is equal to the first boundary', () => {
    const result = findActualVmaxs(2000, vMax);
    expect(result).toEqual([10, 100]);
  });

  it('should return the [0] when the speeds list is shorter than it should', () => {
    const incorrectVMaxs = {
      internalBoundaries: [2000, 3400, 5300, 6000],
      speeds: [10, 100, 200, 100],
    };
    const result1 = findActualVmaxs(6000, incorrectVMaxs);
    expect(result1).toEqual([0]);
    const result2 = findActualVmaxs(6100, incorrectVMaxs);
    expect(result2).toEqual([0]);
  });
});
