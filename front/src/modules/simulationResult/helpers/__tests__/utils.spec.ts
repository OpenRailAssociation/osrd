import { describe, it, expect } from 'vitest';

import { fastFindFirstGreater, interpolateValue } from '../utils';

describe('interpolateValue', () => {
  const reportTrain = {
    positions: [0, 1200, 2500, 4100, 7000],
    speeds: [1, 15, 25, 35, 45],
    times: [0, 8, 17, 29, 50],
  };

  it('should match the average for a position in the middle of an interval', () => {
    // Halfway between 1200 (15) and 2500 (25), thus (15+25)/2 giving 20
    const interpolatedSpeed = interpolateValue(reportTrain, 1850, 'speeds');
    expect(interpolatedSpeed).toBeCloseTo(20, 3);
    // Halfway between 4100 (29) and 7000 (50), thus (29+50)/2 giving 39.5
    const interpolatedTime = interpolateValue(reportTrain, 5550, 'times');
    expect(interpolatedTime).toBeCloseTo(39.5, 3);
  });

  it('should interpolate linearly for a position close to an interval bound', () => {
    // 80% from 2500 (25) to 4100 (35), thus 0.2*25+0.8*35 giving 33
    const interpolatedSpeed = interpolateValue(reportTrain, 3780, 'speeds');
    expect(interpolatedSpeed).toBeCloseTo(33, 3);
    // 10% from 0 (0) to 1200 (8), thus 0.1*8 giving 0.8
    const interpolatedTime = interpolateValue(reportTrain, 120, 'times');
    expect(interpolatedTime).toBeCloseTo(0.8, 3);
  });

  it('should return the exact value when position matches a known point', () => {
    const interpolatedSpeedStart = interpolateValue(reportTrain, 0, 'speeds');
    expect(interpolatedSpeedStart).toBe(1);

    const interpolatedTimeStart = interpolateValue(reportTrain, 0, 'times');
    expect(interpolatedTimeStart).toBe(0);

    const interpolatedSpeedEnd = interpolateValue(reportTrain, 7000, 'speeds');
    expect(interpolatedSpeedEnd).toBe(45);

    const interpolatedTimeMiddle = interpolateValue(reportTrain, 2500, 'times');
    expect(interpolatedTimeMiddle).toBe(17);
  });

  it('should throw an error if trying to interpolate a position out of bonds of the positions list', () => {
    expect(() => interpolateValue(reportTrain, -1, 'speeds')).toThrow(
      'Can not interpolate speeds value with position -1 out of range for 0,1200,2500,4100,7000'
    );
    expect(() => interpolateValue(reportTrain, 7001, 'speeds')).toThrow(
      'Can not interpolate speeds value with position 7001 out of range for 0,1200,2500,4100,7000'
    );
  });
});

describe('fastFindFirstGreater', () => {
  const sorted = [10, 20, 30, 40, 50];

  it('should return the index of the first element greater than threshold', () => {
    expect(fastFindFirstGreater(sorted, 11)).toBe(1);
    expect(fastFindFirstGreater(sorted, 25, true)).toBe(2);
    expect(fastFindFirstGreater(sorted, 47.5, false)).toBe(4);
  });

  it('should return index of equal element if threshold matches exactly', () => {
    expect(fastFindFirstGreater(sorted, 10)).toBe(0);
    expect(fastFindFirstGreater(sorted, 10, true)).toBe(0);
    expect(fastFindFirstGreater(sorted, 30)).toBe(2);
    expect(fastFindFirstGreater(sorted, 50)).toBe(4);
    expect(fastFindFirstGreater(sorted, 50, true)).toBe(4);
  });

  it('should return 0 when threshold is lower than the first element and enforceBounding is not true', () => {
    expect(fastFindFirstGreater(sorted, 5)).toBe(0);
    expect(fastFindFirstGreater(sorted, 5, false)).toBe(0);
  });

  it('should return the length when threshold is greater than the last element and enforceBounding is not true', () => {
    expect(fastFindFirstGreater(sorted, 55)).toBe(5);
    expect(fastFindFirstGreater(sorted, 55, false)).toBe(5);
  });

  it('should return undefined when threshold is out of bounds and enforceBounding is true', () => {
    expect(fastFindFirstGreater(sorted, 5, true)).toBeUndefined();
    expect(fastFindFirstGreater(sorted, 55, true)).toBeUndefined();
  });

  it('should return undefined for an empty list', () => {
    expect(fastFindFirstGreater([], 10)).toBeUndefined();
  });
});
