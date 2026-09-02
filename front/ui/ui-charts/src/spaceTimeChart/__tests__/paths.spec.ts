import { describe, expect, it } from 'vitest';

import type { PathData } from '../lib/types';
import { computeStops, getPathDirection } from '../utils/paths';

const PATH: PathData = {
  id: 'path-back-and-forth',
  label: 'Path',
  points: [
    { time: 0, position: 0 },
    { time: 1, position: 0 },
    { time: 2, position: 10 },
    { time: 3, position: 30 },
    { time: 4, position: 30 },
    { time: 5, position: 20 },
    { time: 6, position: 20 },
    { time: 7, position: 0 },
  ],
};

describe('getPathDirection', () => {
  it('should return the expected directions in "normal" cases', () => {
    // Test extremities:
    expect(getPathDirection(PATH, 0)).toBe('forward');
    expect(getPathDirection(PATH, 7, true)).toBe('backward');

    // Test some normal step:
    expect(getPathDirection(PATH, 2)).toBe('forward');
    expect(getPathDirection(PATH, 2, true)).toBe('forward');

    // Test some "U-turn" point:
    expect(getPathDirection(PATH, 3)).toBe('backward');
    expect(getPathDirection(PATH, 2, true)).toBe('forward');
  });

  it('should return the "stay" for undecidable cases', () => {
    expect(getPathDirection(PATH, 0, true)).toBe('still');
    expect(getPathDirection(PATH, 7)).toBe('still');
  });
});

describe('computeStops', () => {
  it('should return one range per stop, including the first and last ones', () => {
    expect(computeStops(PATH.points, new Set([0, 20, 30]))).toEqual([
      { position: 0, minTime: 0, maxTime: 1 },
      { position: 30, minTime: 3, maxTime: 4 },
      { position: 20, minTime: 5, maxTime: 6 },
    ]);
  });

  it('should merge a stop split into several segments into a single range', () => {
    const points = [
      { time: 0, position: 0 },
      { time: 1, position: 10 },
      { time: 2, position: 10 },
      { time: 3, position: 10 },
      { time: 4, position: 0 },
    ];
    expect(computeStops(points, new Set([10]))).toEqual([{ position: 10, minTime: 1, maxTime: 3 }]);
  });

  it('should keep two visits to the same position as separate ranges', () => {
    const points = [
      { time: 0, position: 0 },
      { time: 1, position: 10 },
      { time: 2, position: 10 },
      { time: 3, position: 20 },
      { time: 4, position: 20 },
      { time: 5, position: 10 },
      { time: 6, position: 10 },
      { time: 7, position: 0 },
    ];
    expect(computeStops(points, new Set([10, 20]))).toEqual([
      { position: 10, minTime: 1, maxTime: 2 },
      { position: 20, minTime: 3, maxTime: 4 },
      { position: 10, minTime: 5, maxTime: 6 },
    ]);
  });

  it('should flush the stop the curve ends on', () => {
    const points = [
      { time: 0, position: 0 },
      { time: 1, position: 10 },
      { time: 2, position: 10 },
    ];
    expect(computeStops(points, new Set([10]))).toEqual([{ position: 10, minTime: 1, maxTime: 2 }]);
  });

  it('should ignore constant-position runs that are not operational points', () => {
    const points = [
      { time: 0, position: 5 },
      { time: 1, position: 5 },
      { time: 2, position: 10 },
    ];
    expect(computeStops(points, new Set([10]))).toEqual([]);
  });
});
