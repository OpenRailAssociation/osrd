import { describe, it, expect } from 'vitest';

import { findActualVmaxs, interpolateValue } from '../utils';

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
});

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

    const interpolatedTime = interpolateValue(reportTrain, 2500, 'times');
    expect(interpolatedTime).toBe(17);

    const interpolatedSpeedEnd = interpolateValue(reportTrain, 7000, 'speeds');
    expect(interpolatedSpeedEnd).toBe(45);
  });
});
