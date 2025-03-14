import { describe, expect, it } from 'vitest';

import { getClosestPointOnSegment } from '../utils/snapping';

describe('getClosestPointOnSegment', () => {
  it('should return the closest point on the given segment', () => {
    const from = { x: 1, y: 2 };
    const to = { x: 3, y: 1 };
    expect(getClosestPointOnSegment({ x: 0, y: 4 }, from, to)).toEqual(from);
    expect(getClosestPointOnSegment({ x: 5, y: 0 }, from, to)).toEqual(to);
    expect(getClosestPointOnSegment({ x: 3, y: 3.5 }, from, to)).toEqual({ x: 2, y: 1.5 });
  });
});
