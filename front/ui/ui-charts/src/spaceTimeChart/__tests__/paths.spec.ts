import { describe, expect, it } from 'vitest';

import type { PathData } from '../lib/types';
import { getPathDirection } from '../utils/paths';

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
