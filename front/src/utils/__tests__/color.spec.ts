import { describe, it, expect } from 'vitest';

import { linearColorScaleInterpolation } from 'utils/color';

describe('linearColorScaleInterpolation', () => {
  it('should work with value in domain range', () => {
    const value = linearColorScaleInterpolation(
      { min: '#000000', max: '#0000FF' },
      { min: 0, max: 255 },
      15
    );
    expect(value.toUpperCase()).toBe('#00000F');
  });
  it('should return min scale with value inferior to domain range', () => {
    const value = linearColorScaleInterpolation(
      { min: '#000000', max: '#0000FF' },
      { min: 0, max: 255 },
      -10
    );
    expect(value.toUpperCase()).toBe('#000000');
  });
  it('should return max scale with value superior to domain range', () => {
    const value = linearColorScaleInterpolation(
      { min: '#000000', max: '#0000FF' },
      { min: 0, max: 255 },
      300
    );
    expect(value.toUpperCase()).toBe('#0000FF');
  });
});
