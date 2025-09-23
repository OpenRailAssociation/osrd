import { describe, expect, it } from 'vitest';

import { getAliasedDiscShape, getCrispLineCoordinate } from '../utils/canvas';

describe('getAliasedDiscShape', () => {
  it('should return return the expected flat matrices', () => {
    expect(getAliasedDiscShape(0)).toEqual(new Uint8Array([1]));
    expect(getAliasedDiscShape(1)).toEqual(new Uint8Array([0, 1, 0, 1, 1, 1, 0, 1, 0]));
    expect(getAliasedDiscShape(2)).toEqual(
      new Uint8Array([0, 0, 1, 0, 0, 0, 1, 1, 1, 0, 1, 1, 1, 1, 1, 0, 1, 1, 1, 0, 0, 0, 1, 0, 0])
    );
  });
});

describe('getCrispLineCoordinate', () => {
  it.each([1, 3, 99, 0.25, 0.5, 0.75])(
    'should align a %dpx line on a LoDPI device',
    (lineWidth) => {
      const devicePixelRatio = 1;
      expect(getCrispLineCoordinate(-0.4, lineWidth, devicePixelRatio)).toEqual(-0.5);
      expect(getCrispLineCoordinate(0, lineWidth, devicePixelRatio)).toEqual(0.5);
      expect(getCrispLineCoordinate(0.1, lineWidth, devicePixelRatio)).toEqual(0.5);
      expect(getCrispLineCoordinate(0.2, lineWidth, devicePixelRatio)).toEqual(0.5);
      expect(getCrispLineCoordinate(0.4, lineWidth, devicePixelRatio)).toEqual(0.5);
      expect(getCrispLineCoordinate(0.5, lineWidth, devicePixelRatio)).toEqual(0.5);
      expect(getCrispLineCoordinate(1.5, lineWidth, devicePixelRatio)).toEqual(1.5);
      expect(getCrispLineCoordinate(42, lineWidth, devicePixelRatio)).toEqual(42.5);
      expect(getCrispLineCoordinate(-0.7, lineWidth, devicePixelRatio)).toEqual(-0.5);
    }
  );

  it.each([2, 4, 64, 1.5])('should align a %dpx line on a LoDPI device', (lineWidth) => {
    const devicePixelRatio = 1;
    expect(getCrispLineCoordinate(-0.4, lineWidth, devicePixelRatio)).toEqual(0);
    expect(getCrispLineCoordinate(0, lineWidth, devicePixelRatio)).toEqual(0);
    expect(getCrispLineCoordinate(0.1, lineWidth, devicePixelRatio)).toEqual(0);
    expect(getCrispLineCoordinate(0.2, lineWidth, devicePixelRatio)).toEqual(0);
    expect(getCrispLineCoordinate(0.4, lineWidth, devicePixelRatio)).toEqual(0);
    expect(getCrispLineCoordinate(0.5, lineWidth, devicePixelRatio)).toEqual(1);
    expect(getCrispLineCoordinate(1.5, lineWidth, devicePixelRatio)).toEqual(2);
    expect(getCrispLineCoordinate(42, lineWidth, devicePixelRatio)).toEqual(42);
    expect(getCrispLineCoordinate(-0.7, lineWidth, devicePixelRatio)).toEqual(-1);
  });

  it.each([1, 2, 3, 4, 99, 0.75])('should align a %dpx line on a HiDPI device', (lineWidth) => {
    const devicePixelRatio = 2;
    expect(getCrispLineCoordinate(-0.4, lineWidth, devicePixelRatio)).toEqual(-0.5);
    expect(getCrispLineCoordinate(0, lineWidth, devicePixelRatio)).toEqual(0);
    expect(getCrispLineCoordinate(0.1, lineWidth, devicePixelRatio)).toEqual(0);
    expect(getCrispLineCoordinate(0.2, lineWidth, devicePixelRatio)).toEqual(0);
    expect(getCrispLineCoordinate(0.4, lineWidth, devicePixelRatio)).toEqual(0.5);
    expect(getCrispLineCoordinate(0.5, lineWidth, devicePixelRatio)).toEqual(0.5);
    expect(getCrispLineCoordinate(1.5, lineWidth, devicePixelRatio)).toEqual(1.5);
    expect(getCrispLineCoordinate(42, lineWidth, devicePixelRatio)).toEqual(42);
    expect(getCrispLineCoordinate(-0.7, lineWidth, devicePixelRatio)).toEqual(-0.5);
  });

  it.each([0.25, 0.5, 1.5])('should align a %dpx line on a HiDPI device', (lineWidth) => {
    const devicePixelRatio = 2;
    expect(getCrispLineCoordinate(-0.4, lineWidth, devicePixelRatio)).toEqual(-0.25);
    expect(getCrispLineCoordinate(0, lineWidth, devicePixelRatio)).toEqual(0.25);
    expect(getCrispLineCoordinate(0.1, lineWidth, devicePixelRatio)).toEqual(0.25);
    expect(getCrispLineCoordinate(0.2, lineWidth, devicePixelRatio)).toEqual(0.25);
    expect(getCrispLineCoordinate(0.4, lineWidth, devicePixelRatio)).toEqual(0.25);
    expect(getCrispLineCoordinate(0.5, lineWidth, devicePixelRatio)).toEqual(0.75);
    expect(getCrispLineCoordinate(1.5, lineWidth, devicePixelRatio)).toEqual(1.75);
    expect(getCrispLineCoordinate(42, lineWidth, devicePixelRatio)).toEqual(42.25);
    expect(getCrispLineCoordinate(-0.7, lineWidth, devicePixelRatio)).toEqual(-0.75);
  });
});
