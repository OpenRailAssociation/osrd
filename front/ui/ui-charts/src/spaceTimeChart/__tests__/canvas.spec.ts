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
  it.each([1, 3, 99])('should align a %ipx line on a LoDPI device', (lineWidth) => {
    const devicePixelRatio = 1;
    expect(getCrispLineCoordinate(0, lineWidth, devicePixelRatio)).toEqual(0.5);
    expect(getCrispLineCoordinate(0.1, lineWidth, devicePixelRatio)).toEqual(0.5);
    expect(getCrispLineCoordinate(0.5, lineWidth, devicePixelRatio)).toEqual(0.5);
    expect(getCrispLineCoordinate(0.9, lineWidth, devicePixelRatio)).toEqual(0.5);
    expect(getCrispLineCoordinate(1, lineWidth, devicePixelRatio)).toEqual(1.5);
    expect(getCrispLineCoordinate(42, lineWidth, devicePixelRatio)).toEqual(42.5);
    expect(getCrispLineCoordinate(-0.4, lineWidth, devicePixelRatio)).toEqual(-0.5);
    expect(getCrispLineCoordinate(-0.7, lineWidth, devicePixelRatio)).toEqual(-0.5);
  });

  it.each([2, 4, 64])('should align a 2px line on a LoDPI device', (lineWidth) => {
    const devicePixelRatio = 1;
    expect(getCrispLineCoordinate(-0.4, lineWidth, devicePixelRatio)).toEqual(0);
    expect(getCrispLineCoordinate(0, lineWidth, devicePixelRatio)).toEqual(0);
    expect(getCrispLineCoordinate(0.4, lineWidth, devicePixelRatio)).toEqual(0);
    expect(getCrispLineCoordinate(0.5, lineWidth, devicePixelRatio)).toEqual(1);
    expect(getCrispLineCoordinate(1.5, lineWidth, devicePixelRatio)).toEqual(2);
    expect(getCrispLineCoordinate(42, lineWidth, devicePixelRatio)).toEqual(42);
    expect(getCrispLineCoordinate(-0.7, lineWidth, devicePixelRatio)).toEqual(-1);
  });

  it('should align a 2px line on a HiDPI device', () => {
    const devicePixelRatio = 2;
    const lineWidth = 2;
    expect(getCrispLineCoordinate(0.5, lineWidth, devicePixelRatio)).toEqual(0.5);
  });

  it('should align a 0.5px line on a HiDPI device', () => {
    const devicePixelRatio = 2;
    const lineWidth = 0.5;
    expect(getCrispLineCoordinate(0, lineWidth, devicePixelRatio)).toEqual(0.25);
  });
});
