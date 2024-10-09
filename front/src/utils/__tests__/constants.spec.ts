import { describe, it, expect } from 'vitest';

import { makeEnumBooleans } from 'utils/constants';

describe('makeEnumBooleans', () => {
  it('should return an empty object', () => {
    const list = {};
    expect(makeEnumBooleans(list, null)).toEqual({});
  });
  it('should return an object of booleans', () => {
    const list = {
      valueA: Symbol('valueA'),
      valueB: Symbol('valueB'),
    };
    const value = list.valueA;
    expect(makeEnumBooleans(list, value)).toEqual({ isValueA: true, isValueB: false });
  });
});
