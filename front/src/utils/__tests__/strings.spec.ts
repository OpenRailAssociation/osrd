import { capitalizeFirstLetter, conditionalStringConcat } from 'utils/strings';

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

describe('capitalizeFirstLetter', () => {
  it('should capitalize first letter if there is multiple words', () => {
    expect(capitalizeFirstLetter('service stop')).toBe('Service stop');
  });
  it('should capitalize first letter if there is one word', () => {
    expect(capitalizeFirstLetter('passage')).toBe('Passage');
  });
});
