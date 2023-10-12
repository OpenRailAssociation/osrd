import { splitArrayByFirstLetter } from 'utils/array';

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
