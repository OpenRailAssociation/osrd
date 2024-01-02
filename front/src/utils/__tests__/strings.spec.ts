import { conditionalStringConcat, onlyDigit } from 'utils/strings';

describe('conditionalStringConcat', () => {
  it('should return concatenated string', () => {
    expect(
      conditionalStringConcat([
        [true, 'abcd'],
        [true, 'efg'],
      ])
    ).toBe('abcd, efg');
  });
  it('should ignore falsy entries', () => {
    expect(
      conditionalStringConcat<boolean | undefined | string | null>([
        [true, 'abcd'],
        [undefined, 'ζ'],
        ['', 'efg'],
        [true, 'αβγ'],
        [null, 'efg'],
      ])
    ).toBe('abcd, αβγ');
  });
  it('custom separator', () => {
    expect(
      conditionalStringConcat(
        [
          [true, 'abcd'],
          [true, 'efghij'],
        ],
        '_'
      )
    ).toBe('abcd_efghij');
  });
});

describe('onlyDigits', () => {
  it('should return the whole string (only digits)', () => {
    expect(onlyDigit('1234')).toBe('1234');
  });
  it('should filter the letter characters', () => {
    expect(onlyDigit('1ab2c34')).toBe('1234');
  });
  it('should not filter the dot (.) character', () => {
    expect(onlyDigit('1.234')).toBe('1.234');
  });
});
