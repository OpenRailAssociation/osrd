import { describe, it, expect } from 'vitest';

import { cutSpaceTimeRect } from '../cutSpaceTimeCurves';

describe('cutSpaceTimeRect', () => {
  it('should return null if the interpolated range ends before the cut space', () => {
    const range = {
      spaceStart: 3,
      spaceEnd: 5,
      timeStart: 100,
      timeEnd: 200,
    };
    const interpolatedRange = cutSpaceTimeRect(range, 1, 3);
    expect(interpolatedRange).toBeNull();
  });

  it('should return null if the interpolated range starts after the cut space', () => {
    const range = {
      spaceStart: 3,
      spaceEnd: 5,
      timeStart: 100,
      timeEnd: 200,
    };
    const interpolatedRange = cutSpaceTimeRect(range, 5, 7);
    expect(interpolatedRange).toBeNull();
  });

  it('should return the same range if its ranges are inside the cut space', () => {
    const range = {
      spaceStart: 3,
      spaceEnd: 5,
      timeStart: 100,
      timeEnd: 200,
    };
    const interpolatedRange = cutSpaceTimeRect(range, 2, 7);
    expect(interpolatedRange).toEqual(range);
  });

  it('should return the interpolated range when the start position is outside the cut space', () => {
    const range = {
      spaceStart: 3,
      spaceEnd: 5,
      timeStart: 100,
      timeEnd: 200,
    };
    const interpolatedRange = cutSpaceTimeRect(range, 4, 5);
    expect(interpolatedRange).toEqual({
      spaceStart: 4,
      spaceEnd: 5,
      timeStart: 150,
      timeEnd: 200,
    });
  });

  it('should return the interpolated range when the end position is is outside the cut space', () => {
    const range = {
      spaceStart: 3,
      spaceEnd: 6,
      timeStart: 100,
      timeEnd: 160,
    };
    const interpolatedRange = cutSpaceTimeRect(range, 3, 5);
    expect(interpolatedRange).toEqual({
      spaceStart: 3,
      spaceEnd: 5,
      timeStart: 100,
      timeEnd: 140,
    });
  });

  it('should return the interpolated range when both positions are outside the cut space', () => {
    const range = {
      spaceStart: 3,
      spaceEnd: 6,
      timeStart: 100,
      timeEnd: 160,
    };
    const interpolatedRange = cutSpaceTimeRect(range, 4, 5);
    expect(interpolatedRange).toEqual({
      spaceStart: 4,
      spaceEnd: 5,
      timeStart: 120,
      timeEnd: 140,
    });
  });
});
