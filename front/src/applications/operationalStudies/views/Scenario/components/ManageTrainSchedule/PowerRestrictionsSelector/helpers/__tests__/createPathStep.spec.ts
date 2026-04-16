import { describe, it, expect } from 'vitest';

import type { IntervalItem } from 'common/IntervalsEditor/types';
import { NO_POWER_RESTRICTION } from 'modules/powerRestriction/consts';

import { cutRange } from '../createPathStep';

describe('cutRange', () => {
  const allRanges: IntervalItem[] = [
    { begin: 0, end: 200, value: NO_POWER_RESTRICTION },
    { begin: 200, end: 340, value: NO_POWER_RESTRICTION },
    { begin: 340, end: 660, value: NO_POWER_RESTRICTION },
    { begin: 660, end: 800, value: NO_POWER_RESTRICTION },
    { begin: 800, end: 1000, value: NO_POWER_RESTRICTION },
    { begin: 1000, end: 1100, value: NO_POWER_RESTRICTION },
  ];
  const customRanges: IntervalItem[] = [
    { begin: 200, end: 340, value: NO_POWER_RESTRICTION },
    { begin: 800, end: 1000, value: NO_POWER_RESTRICTION },
  ];
  const pathLength = 1100;

  it('should properly cut a custom range in 2', () => {
    const result = cutRange(allRanges, customRanges, pathLength, 250);
    expect(result).toEqual([
      { begin: 200, end: 250, value: NO_POWER_RESTRICTION },
      { begin: 250, end: 340, value: NO_POWER_RESTRICTION },
      { begin: 800, end: 1000, value: NO_POWER_RESTRICTION },
    ]);
  });

  it('should properly create 2 new custom ranges', () => {
    const result = cutRange(allRanges, customRanges, pathLength, 600);
    expect(result).toEqual([
      { begin: 200, end: 340, value: NO_POWER_RESTRICTION },
      { begin: 340, end: 600, value: NO_POWER_RESTRICTION },
      { begin: 600, end: 660, value: NO_POWER_RESTRICTION },
      { begin: 800, end: 1000, value: NO_POWER_RESTRICTION },
    ]);
  });

  it('should properly create 2 new ranges after the last custom range', () => {
    const result = cutRange(allRanges, customRanges, pathLength, 1050);
    expect(result).toEqual([
      { begin: 200, end: 340, value: NO_POWER_RESTRICTION },
      { begin: 800, end: 1000, value: NO_POWER_RESTRICTION },
      { begin: 1000, end: 1050, value: NO_POWER_RESTRICTION },
      { begin: 1050, end: 1100, value: NO_POWER_RESTRICTION },
    ]);
  });

  it('should properly create 2 new ranges before the first custom range', () => {
    const result = cutRange(allRanges, customRanges, pathLength, 50);
    expect(result).toEqual([
      { begin: 0, end: 50, value: NO_POWER_RESTRICTION },
      { begin: 50, end: 200, value: NO_POWER_RESTRICTION },
      { begin: 200, end: 340, value: NO_POWER_RESTRICTION },
      { begin: 800, end: 1000, value: NO_POWER_RESTRICTION },
    ]);
  });

  it('should properly create 2 new ranges if allRanges has only 1 element', () => {
    const result = cutRange(
      [{ begin: 0, end: 1100, value: NO_POWER_RESTRICTION }],
      [],
      pathLength,
      500
    );
    expect(result).toEqual([
      { begin: 0, end: 500, value: NO_POWER_RESTRICTION },
      { begin: 500, end: 1100, value: NO_POWER_RESTRICTION },
    ]);
  });

  it('should throw an error if trying to cut at an invalid position', () => {
    expect(() => cutRange(allRanges, customRanges, pathLength, 2000)).toThrow(
      'Invalid cut position: can not properly insert the new range'
    );
  });
});
