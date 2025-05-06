import { describe, it, expect } from 'vitest';

import { budgetFormat, isFloat, isInvalidFloatNumber } from 'utils/numbers';
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
