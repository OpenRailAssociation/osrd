import { describe, it, expect } from 'vitest';

import { budgetFormat, isFloat, isInvalidFloatNumber, stripDecimalDigits } from 'utils/numbers';
import { NARROW_NO_BREAK_SPACE, NO_BREAK_SPACE } from 'utils/strings';

describe('budgetFormat', () => {
  it('should return the complete number as a currency (€)', () => {
    expect(budgetFormat(45968493)).toBe(
      `45${NARROW_NO_BREAK_SPACE}968${NARROW_NO_BREAK_SPACE}493${NO_BREAK_SPACE}€`
    );
  });
});

describe('stripDecimalDigits', () => {
  it('should return the integer part of the number when decimalPlaces is 0', () => {
    expect(stripDecimalDigits(123.456, 0)).toBe(123);
  });

  it('should return the same number when decimalPlaces is negative', () => {
    expect(stripDecimalDigits(123.456, -1)).toBe(123.456);
  });

  it('should return the same number when decimalPlaces is NaN', () => {
    expect(stripDecimalDigits(123.456, NaN)).toBe(123.456);
  });

  it('should return the same number when decimalPlaces is not an integer', () => {
    expect(stripDecimalDigits(123.456, 1.5)).toBe(123.456);
  });

  it('should return the same number when decimalPlaces is infinite', () => {
    expect(stripDecimalDigits(123.456, Infinity)).toBe(123.456);
  });

  it('should return the same number when the number is NaN', () => {
    expect(stripDecimalDigits(NaN, 1)).toBe(NaN);
  });

  it('should return the same number when the number is infinite', () => {
    expect(stripDecimalDigits(Infinity, 1)).toBe(Infinity);
  });

  it('should return the same number when the number is not finite', () => {
    expect(stripDecimalDigits(1 / 0, 1)).toBe(Infinity);
  });

  it('should return the same number when the number is 0', () => {
    expect(stripDecimalDigits(0, 1)).toBe(0);
  });

  it('should return the same number when the number has no decimal part', () => {
    expect(stripDecimalDigits(123, 1)).toBe(123);
  });

  it('should return the same number when the number has less decimal digits than decimalPlaces', () => {
    expect(stripDecimalDigits(123.4, 2)).toBe(123.4);
  });

  it('should return the same number when the number has the same decimal digits than decimalPlaces', () => {
    expect(stripDecimalDigits(123.45, 2)).toBe(123.45);
  });

  it('should return the same number when the number has more decimal digits than decimalPlaces', () => {
    expect(stripDecimalDigits(123.456, 2)).toBe(123.45);
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
  });

  it('should return false if the number is NaN', () => {
    expect(isFloat(NaN)).toBe(false);
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
