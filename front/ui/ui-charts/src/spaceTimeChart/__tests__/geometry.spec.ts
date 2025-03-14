import { describe, expect, it } from 'vitest';

import { intersectsSegments, isSegmentOnScreen } from '../utils/geometry';

describe('intersectsSegments', () => {
  it('should return false for parallel segments', () => {
    expect(intersectsSegments({ x: 0, y: 0 }, { x: 5, y: 5 }, { x: 0, y: 1 }, { x: 5, y: 6 })).toBe(
      false
    );
  });

  it('should return true for intersecting segments', () => {
    expect(intersectsSegments({ x: 0, y: 0 }, { x: 5, y: 5 }, { x: 0, y: 5 }, { x: 5, y: 0 })).toBe(
      true
    );
  });

  it('should return false for non-intersecting segments', () => {
    expect(intersectsSegments({ x: 0, y: 0 }, { x: 2, y: 2 }, { x: 3, y: 3 }, { x: 5, y: 5 })).toBe(
      false
    );
  });
});

describe('isSegmentOnScreen', () => {
  const canvasWidth = 100;
  const canvasHeight = 100;

  it('should return true if either point is within canvas bounds', () => {
    expect(isSegmentOnScreen(canvasWidth, canvasHeight, { x: 10, y: 10 }, { x: 150, y: 150 })).toBe(
      true
    );
    expect(isSegmentOnScreen(canvasWidth, canvasHeight, { x: 150, y: 150 }, { x: 10, y: 10 })).toBe(
      true
    );
    expect(isSegmentOnScreen(canvasWidth, canvasHeight, { x: 90, y: 90 }, { x: 10, y: 10 })).toBe(
      true
    );
  });

  it('should return true for segments intersecting one edge', () => {
    expect(isSegmentOnScreen(canvasWidth, canvasHeight, { x: -10, y: 50 }, { x: 110, y: 50 })).toBe(
      true
    );
    expect(isSegmentOnScreen(canvasWidth, canvasHeight, { x: 50, y: -10 }, { x: 50, y: 110 })).toBe(
      true
    );
  });

  it('should return false for segments completely outside the canvas', () => {
    expect(isSegmentOnScreen(canvasWidth, canvasHeight, { x: -10, y: -10 }, { x: -5, y: -5 })).toBe(
      false
    );
  });
});
