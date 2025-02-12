import { describe, it, expect } from 'vitest';

import { insertCutPosition } from '../createPathStep';

describe('insertCutPosition', () => {
  const cutPositions = [200, 340, 660, 800];

  it('should properly insert a new cut position between 2 values', () => {
    const result = insertCutPosition(cutPositions, 350);
    expect(result).toEqual([200, 340, 350, 660, 800]);
  });

  it('should properly insert a new cut position just before the end of the existing array', () => {
    const result = insertCutPosition(cutPositions, 700);
    expect(result).toEqual([200, 340, 660, 700, 800]);
  });

  it('should properly insert a new cut position at the begin of the existing array', () => {
    const result = insertCutPosition(cutPositions, 100);
    expect(result).toEqual([100, 200, 340, 660, 800]);
  });

  it('should properly insert a new cut position at the end of the existing array', () => {
    const result = insertCutPosition(cutPositions, 820);
    expect(result).toEqual([200, 340, 660, 800, 820]);
  });

  it('should ignore the new position if it is already in the array', () => {
    expect(insertCutPosition(cutPositions, 200)).toEqual([200, 340, 660, 800]);
    expect(insertCutPosition(cutPositions, 340)).toEqual([200, 340, 660, 800]);
    expect(insertCutPosition(cutPositions, 800)).toEqual([200, 340, 660, 800]);
  });
});
