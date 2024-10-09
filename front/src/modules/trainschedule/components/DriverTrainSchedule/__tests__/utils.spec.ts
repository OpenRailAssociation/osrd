import { describe, it, expect } from 'vitest';

import { findActualVmax } from '../utils';

describe('findActualVmax', () => {
  const vMax = { internalBoundaries: [2000, 3400, 5300, 6000], speeds: [10, 100, 200, 100, 150] };

  it('should return the correct Vmax', () => {
    const result = findActualVmax(2500, vMax);
    expect(result).toEqual(100);
  });

  it('should return the correct Vmax when the givenPosition is in the last interval', () => {
    const result = findActualVmax(7000, vMax);
    expect(result).toEqual(150);
  });

  it('should return the correct Vmax when the givenPosition is in thefirst interval', () => {
    const result = findActualVmax(1000, vMax);
    expect(result).toEqual(10);
  });

  it('should return the min Vmax when givenPosition is equal to a boundary (min before)', () => {
    const result = findActualVmax(3400, vMax);
    expect(result).toEqual(100);
  });

  it('should return the min Vmax when givenPosition is equal to a boundary (min after)', () => {
    const result = findActualVmax(5300, vMax);
    expect(result).toEqual(100);
  });
});
