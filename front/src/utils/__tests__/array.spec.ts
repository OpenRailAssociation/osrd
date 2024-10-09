import { describe, it, expect } from 'vitest';

import { addElementAtIndex, isEmptyArray, splitArrayByFirstLetter } from 'utils/array';

describe('isEmptyArray', () => {
  it('should return true', () => {
    const array: string[] = [];
    expect(isEmptyArray(array)).toBe(true);
  });

  it('should return false', () => {
    const array: string[] = ['a', 'b'];
    expect(isEmptyArray(array)).toBe(false);
  });
});

describe('splitArrayByFirstLetter', () => {
  it('should return two empty arrays', () => {
    const array: string[] = [];
    const results = splitArrayByFirstLetter(array);
    expect(results).toEqual([[], []]);
  });
  it('should return an array of digit starting strings and one empty array', () => {
    const array = ['1USMD', '2PMSZ', '0'];
    const [digitArray, emptyArray] = splitArrayByFirstLetter(array);
    expect(digitArray).toEqual(['0', '1USMD', '2PMSZ']);
    expect(emptyArray).toEqual([]);
  });
  it('should return an empty array and an array of letter starting strings', () => {
    const array = ['USMDI', 'C1UM', 'BMDPC'];
    const [digitArray, letterArray] = splitArrayByFirstLetter(array);
    expect(digitArray).toEqual([]);
    expect(letterArray).toEqual(['BMDPC', 'C1UM', 'USMDI']);
  });
  it('should return an array of digit or special characters starting strings an one of letter starting strings', () => {
    const array = ['USMDI', 'C1UM', '3MDPC', '5QSDF', '0POIUY', '%LUNC'];
    const [digitArray, letterArray] = splitArrayByFirstLetter(array);
    expect(digitArray).toEqual(['%LUNC', '0POIUY', '3MDPC', '5QSDF']);
    expect(letterArray).toEqual(['C1UM', 'USMDI']);
  });
});

describe('addElementAtIndex', () => {
  it('should add the element at the specified index', () => {
    const array = [1, 3, 4];
    const updatedArray = addElementAtIndex(array, 1, 2);
    expect(updatedArray).toEqual([1, 2, 3, 4]);
  });
  it('should add the element at the specified index with a negative index', () => {
    const array = [1, 2, 4];
    const updatedArray = addElementAtIndex(array, -1, 3);
    expect(updatedArray).toEqual([1, 2, 3, 4]);
  });
  it('should add the new element at the end of the array if index is larger than the length of the array', () => {
    const array = [1, 2, 3];
    const updatedArray = addElementAtIndex(array, 5, 4);
    expect(updatedArray).toEqual([1, 2, 3, 4]);
  });
});
