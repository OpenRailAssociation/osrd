import { conditionalStringConcat } from 'utils/strings';

describe('conditionalStringConcat', () => {
  it('should return concatenated string', () => {
    expect(
      conditionalStringConcat([
        [true, 'abcd'],
        [true, 'efg'],
      ])
    ).toEqual('abcd, efg');
  });
  it('should ignore falsy entries', () => {
    expect(
      conditionalStringConcat([
        [true, 'abcd'],
        [undefined, 'ζ'],
        ['', 'efg'],
        [true, 'αβγ'],
        [null, 'efg'],
      ])
    ).toEqual('abcd, αβγ');
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
    ).toEqual('abcd_efghij');
  });
});
