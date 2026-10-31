import { describe, it, expect } from 'vitest';

import { capitalizeFirstLetter, conditionalStringConcat, truncateTextStart } from 'utils/strings';

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

describe('truncateTextStart', () => {
  const measure = (value: string) => value.length;

  it('should return the text unchanged when it fits', () => {
    expect(truncateTextStart('8210 coucou 1', 13, measure)).toBe('8210 coucou 1');
  });
  it('should replace the start with an ellipsis and keep the end', () => {
    expect(truncateTextStart('8210 coucou 12', 10, measure)).toBe('…coucou 12');
  });
  it('should return only the ellipsis when nothing else fits', () => {
    expect(truncateTextStart('8210 coucou 1', 1, measure)).toBe('…');
  });
});
