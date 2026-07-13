import { describe, it, expect } from 'vitest';

import {
  budgetFormat,
  isFloat,
  isInvalidFloatNumber,
  lcm,
  linearScaleInterpolation,
} from 'utils/numbers';
import { NARROW_NO_BREAK_SPACE, NO_BREAK_SPACE } from 'utils/strings';

describe('budgetFormat', () => {
  it('should return the complete number as a currency (€)', () => {
    expect(budgetFormat(45968493)).toBe(
      `45${NARROW_NO_BREAK_SPACE}968${NARROW_NO_BREAK_SPACE}493${NO_BREAK_SPACE}€`
    );
  });
});

describe('isFloat', () => {
  it('should return true if the number is a float with a lot of digits', () => {
    expect(isFloat(1.123456789012345)).toBe(true);
  });

  it('should return true if the number is a float', () => {
    expect(isFloat(1.1)).toBe(true);
  });

  it('should return false if the number is an integer', () => {
    expect(isFloat(1)).toBe(false);
    expect(isFloat(2.0)).toBe(false);
  });

  it('should return false if the number is NaN', () => {
    expect(isFloat(NaN)).toBe(false);
  });

  it('should return false if the number is infinite', () => {
    expect(isFloat(Infinity)).toBe(false);
    expect(isFloat(-Infinity)).toBe(false);
  });
});

describe('lcm', () => {
  it('should compute the least common multiple of two integers', () => {
    expect(lcm(4, 6)).toBe(12);
    expect(lcm(3, 5)).toBe(15);
    expect(lcm(2, 3)).toBe(6);
  });

  it('should return 0 when either operand is 0', () => {
    expect(lcm(0, 5)).toBe(0);
    expect(lcm(5, 0)).toBe(0);
  });

  it('should return the number itself when both operands are equal', () => {
    expect(lcm(7, 7)).toBe(7);
  });
});

describe('isInvalidFloatNumber', () => {
  it('should return true if the number has more decimal places than allowed', () => {
    expect(isInvalidFloatNumber(17.12345, 1)).toBe(true);
  });

  it('should return false if the number has the same number of decimal places than allowed', () => {
    expect(isInvalidFloatNumber(17.1, 1)).toBe(false);
  });

  it('should return false if the number has less decimal places than allowed', () => {
    expect(isInvalidFloatNumber(17.1, 2)).toBe(false);
  });

  it('should return false if the number is NaN', () => {
    expect(isInvalidFloatNumber(NaN, 1)).toBe(false);
  });

  it('should return false if the number is a float and decimal number is NaN', () => {
    expect(isInvalidFloatNumber(10.5, NaN)).toBe(false);
  });

  it('should return false if the number is NaN and decimal number is NaN', () => {
    expect(isInvalidFloatNumber(NaN, NaN)).toBe(false);
  });
});

describe('linearScaleInterpolation', () => {
  it('should work with value in domain range', () => {
    const value = linearScaleInterpolation({ from: 0, to: 100 }, { min: 2000, max: 2025 }, 2005);
    expect(value).toBe(20);

    const value2 = linearScaleInterpolation({ from: 100, to: 0 }, { min: 2000, max: 2025 }, 2005);
    expect(value2).toBe(80);
  });
  it('should return "from" scale with value inferior to domain range', () => {
    const value = linearScaleInterpolation({ from: 0, to: 100 }, { min: 2000, max: 2025 }, 1998);
    expect(value).toBe(0);

    const value2 = linearScaleInterpolation({ from: 100, to: 0 }, { min: 2000, max: 2025 }, 1998);
    expect(value2).toBe(100);
  });
  it('should return "to" scale with value superior to domain range', () => {
    const value = linearScaleInterpolation({ from: 0, to: 100 }, { min: 2000, max: 2025 }, 2026);
    expect(value).toBe(100);

    const value2 = linearScaleInterpolation({ from: 100, to: 0 }, { min: 2000, max: 2025 }, 2026);
    expect(value2).toBe(0);
  });
  it('should return "from" scale with value equal to min domain range', () => {
    const value = linearScaleInterpolation({ from: 0, to: 100 }, { min: 2000, max: 2025 }, 2000);
    expect(value).toBe(0);

    const value2 = linearScaleInterpolation({ from: 100, to: 0 }, { min: 2000, max: 2025 }, 2000);
    expect(value2).toBe(100);
  });
  it('should return "to" scale with value equal to max domain range', () => {
    const value = linearScaleInterpolation({ from: 0, to: 100 }, { min: 2000, max: 2025 }, 2025);
    expect(value).toBe(100);

    const value2 = linearScaleInterpolation({ from: 100, to: 0 }, { min: 2000, max: 2025 }, 2025);
    expect(value2).toBe(0);
  });
  it('should throw when domain min is greater than max', () => {
    expect(() => linearScaleInterpolation({ from: 0, to: 10 }, { min: 100, max: 0 }, 50)).toThrow();
  });
});
