import { pick } from 'lodash';
import { describe, expect, it } from 'vitest';

import { type NormalizedScale } from '../lib/types';
import {
  getNormalizedScaleAtPixel,
  getNormalizedScaleAtPosition,
  getSpaceBreakpoints,
  spaceScalesToBinaryTree,
} from '../utils/scales';

const ORIGIN = 0;
const VALID_SCALES = [
  { to: 10, size: 50 },
  { to: 60, size: 50 },
  { to: 70, size: 50 },
  { to: 90, size: 50 },
  { to: 140, size: 50 },
];

describe('spaceScalesToBinaryTree', () => {
  it('should throw errors when at least one input scale is not valid', () => {
    expect(() => spaceScalesToBinaryTree(1000, [{ to: 0, size: 50 }])).toThrow();
    expect(() => spaceScalesToBinaryTree(0, [{ to: 1000, size: -50 }])).toThrow();
    expect(() => spaceScalesToBinaryTree(0, [{ to: 1000, coefficient: -1 }])).toThrow();
  });

  it('should throw errors when input scales are not properly consecutive', () => {
    expect(() =>
      spaceScalesToBinaryTree(0, [
        { to: 1000, size: 50 },
        { to: 500, size: 50 },
      ])
    ).toThrow();
  });

  it('should return the expected binary tree', () => {
    expect(spaceScalesToBinaryTree(ORIGIN, VALID_SCALES, true)).toEqual({
      left: {
        left: {
          left: {
            coefficient: 10 / 50,
            from: 0,
            to: 10,
            pixelFrom: 0,
            pixelTo: 50,
          },
          right: {
            coefficient: 50 / 50,
            from: 10,
            to: 60,
            pixelFrom: 50,
            pixelTo: 100,
          },
          limit: 10,
          from: 0,
          to: 60,
          pixelLimit: 50,
          pixelFrom: 0,
          pixelTo: 100,
        },
        right: {
          coefficient: 10 / 50,
          from: 60,
          to: 70,
          pixelFrom: 100,
          pixelTo: 150,
        },
        limit: 60,
        from: 0,
        to: 70,
        pixelLimit: 100,
        pixelFrom: 0,
        pixelTo: 150,
      },
      right: {
        left: {
          coefficient: 20 / 50,
          from: 70,
          to: 90,
          pixelFrom: 150,
          pixelTo: 200,
        },
        right: {
          coefficient: 50 / 50,
          from: 90,
          to: 140,
          pixelFrom: 200,
          pixelTo: 250,
        },
        limit: 90,
        from: 70,
        to: 140,
        pixelLimit: 200,
        pixelFrom: 150,
        pixelTo: 250,
      },
      limit: 70,
      from: 0,
      to: 140,
      pixelLimit: 150,
      pixelFrom: 0,
      pixelTo: 250,
    });
  });

  it('should work properly with weird flat-step-only scales', () => {
    expect(spaceScalesToBinaryTree(0, [{ to: 0, size: 50 }])).toEqual({
      coefficient: 0 / 50,
      from: 0,
      to: 0,
      pixelFrom: 0,
      pixelTo: 50,
    });
  });
});

describe('getSpaceBreakpoints', () => {
  const TREE = spaceScalesToBinaryTree(ORIGIN, VALID_SCALES);

  it('should work with normal case', () => {
    expect(getSpaceBreakpoints(5, 135, TREE)).toEqual([10, 60, 70, 90]);
  });

  it('should work with reversed inputs case', () => {
    expect(getSpaceBreakpoints(135, 5, TREE)).toEqual([90, 70, 60, 10]);
  });

  it('should not include boundaries', () => {
    expect(getSpaceBreakpoints(0, 140, TREE)).toEqual([10, 60, 70, 90]);
  });

  it('should not include twice the same breakpoint, when there are "empty scales"', () => {
    const tree = spaceScalesToBinaryTree(ORIGIN, [
      { to: 10, size: 50 },
      { to: 60, size: 50 },
      { to: 60, size: 50 },
      { to: 70, size: 50 },
      { to: 90, size: 50 },
      { to: 140, size: 50 },
    ]);
    expect(getSpaceBreakpoints(5, 135, tree)).toEqual([10, 60, 60, 70, 90]);
  });
});

describe('getNormalizedScaleAtPosition', () => {
  const TREE = spaceScalesToBinaryTree(ORIGIN, VALID_SCALES);

  it('should work with normal case', () => {
    expect(pick(getNormalizedScaleAtPosition(5, TREE) as NormalizedScale, 'from', 'to')).toEqual({
      from: 0,
      to: 10,
    });
    expect(pick(getNormalizedScaleAtPosition(75, TREE) as NormalizedScale, 'from', 'to')).toEqual({
      from: 70,
      to: 90,
    });
    expect(pick(getNormalizedScaleAtPosition(130, TREE) as NormalizedScale, 'from', 'to')).toEqual({
      from: 90,
      to: 140,
    });
  });

  it('should work with extremities', () => {
    expect(pick(getNormalizedScaleAtPosition(0, TREE) as NormalizedScale, 'from', 'to')).toEqual({
      from: 0,
      to: 10,
    });
    expect(pick(getNormalizedScaleAtPosition(140, TREE) as NormalizedScale, 'from', 'to')).toEqual({
      from: 90,
      to: 140,
    });
  });

  it('should work with flat sections', () => {
    const tree = spaceScalesToBinaryTree(ORIGIN, [
      { to: 10, size: 50 },
      { to: 60, size: 50 },
      { to: 60, size: 50 },
      { to: 70, size: 50 },
      { to: 90, size: 50 },
      { to: 140, size: 50 },
    ]);

    expect(pick(getNormalizedScaleAtPosition(60, tree) as NormalizedScale, 'from', 'to')).toEqual({
      from: 10,
      to: 60,
    });

    expect(
      pick(getNormalizedScaleAtPosition(60, tree, true) as NormalizedScale, 'from', 'to')
    ).toEqual({
      from: 60,
      to: 70,
    });
  });

  it('should work with ONLY a flat section', () => {
    const tree = spaceScalesToBinaryTree(ORIGIN, [{ to: 0, size: 50 }]);

    expect(
      pick(getNormalizedScaleAtPosition(0, tree) as NormalizedScale, 'pixelFrom', 'pixelTo')
    ).toEqual({
      pixelFrom: 0,
      pixelTo: 50,
    });

    expect(
      pick(getNormalizedScaleAtPosition(0, tree, true) as NormalizedScale, 'pixelFrom', 'pixelTo')
    ).toEqual({
      pixelFrom: 0,
      pixelTo: 50,
    });
  });

  it('should return extremities when out of scope', () => {
    expect(pick(getNormalizedScaleAtPosition(-1, TREE) as NormalizedScale, 'from', 'to')).toEqual({
      from: 0,
      to: 10,
    });
    expect(pick(getNormalizedScaleAtPosition(141, TREE) as NormalizedScale, 'from', 'to')).toEqual({
      from: 90,
      to: 140,
    });
  });
});

describe('getNormalizedScaleAtPixel', () => {
  const TREE = spaceScalesToBinaryTree(ORIGIN, VALID_SCALES);

  it('should work with normal case', () => {
    expect(pick(getNormalizedScaleAtPixel(25, TREE) as NormalizedScale, 'from', 'to')).toEqual({
      from: 0,
      to: 10,
    });
    expect(pick(getNormalizedScaleAtPixel(170, TREE) as NormalizedScale, 'from', 'to')).toEqual({
      from: 70,
      to: 90,
    });
    expect(pick(getNormalizedScaleAtPixel(240, TREE) as NormalizedScale, 'from', 'to')).toEqual({
      from: 90,
      to: 140,
    });
  });

  it('should work with extremities', () => {
    expect(pick(getNormalizedScaleAtPixel(0, TREE) as NormalizedScale, 'from', 'to')).toEqual({
      from: 0,
      to: 10,
    });
    expect(pick(getNormalizedScaleAtPixel(250, TREE) as NormalizedScale, 'from', 'to')).toEqual({
      from: 90,
      to: 140,
    });
  });

  it('should work with flat sections', () => {
    const tree = spaceScalesToBinaryTree(ORIGIN, [
      { to: 10, size: 50 },
      { to: 60, size: 50 },
      { to: 60, size: 50 },
      { to: 70, size: 50 },
      { to: 90, size: 50 },
      { to: 140, size: 50 },
    ]);
    expect(pick(getNormalizedScaleAtPixel(100, tree) as NormalizedScale, 'from', 'to')).toEqual({
      from: 10,
      to: 60,
    });
    expect(pick(getNormalizedScaleAtPixel(125, tree) as NormalizedScale, 'from', 'to')).toEqual({
      from: 60,
      to: 60,
    });
    expect(pick(getNormalizedScaleAtPixel(150, tree) as NormalizedScale, 'from', 'to')).toEqual({
      from: 60,
      to: 60,
    });
  });

  it('should return extremities when out of scope', () => {
    expect(pick(getNormalizedScaleAtPixel(-1, TREE) as NormalizedScale, 'from', 'to')).toEqual({
      from: 0,
      to: 10,
    });
    expect(pick(getNormalizedScaleAtPixel(251, TREE) as NormalizedScale, 'from', 'to')).toEqual({
      from: 90,
      to: 140,
    });
  });
});
