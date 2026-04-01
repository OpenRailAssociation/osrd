import { describe, it, expect } from 'vitest';

import { linearColorScaleInterpolation } from 'utils/color';

describe('linearColorScaleInterpolation', () => {
  it('should work with value in domain range', () => {
    const value = linearColorScaleInterpolation(
      { from: '#000000', to: '#0000FF' },
      { min: 0, max: 255 },
      15
    );
    expect(value.toUpperCase()).toBe('#00000F');
  });
  it('should return "from"" scale with value inferior to domain range', () => {
    const value = linearColorScaleInterpolation(
      { from: '#000000', to: '#0000FF' },
      { min: 0, max: 255 },
      -10
    );
    expect(value.toUpperCase()).toBe('#000000');
  });
  it('should return "to" scale with value superior to domain range', () => {
    const value = linearColorScaleInterpolation(
      { from: '#000000', to: '#0000FF' },
      { min: 0, max: 255 },
      300
    );
    expect(value.toUpperCase()).toBe('#0000FF');
  });

  it('should return "from" scale with value equal to min domain range', () => {
    const value = linearColorScaleInterpolation(
      { from: '#000000', to: '#0000FF' },
      { min: 0, max: 255 },
      0
    );
    expect(value.toUpperCase()).toBe('#000000');
  });
  it('should return "to" scale with value equal to max domain range', () => {
    const value = linearColorScaleInterpolation(
      { from: '#000000', to: '#0000FF' },
      { min: 0, max: 255 },
      255
    );
    expect(value.toUpperCase()).toBe('#0000FF');
  });
  it('should throw when domain min is greater than max', () => {
    expect(() =>
      linearColorScaleInterpolation({ from: '#000000', to: '#0000FF' }, { min: 100, max: 0 }, 50)
    ).toThrow();
  });
});
