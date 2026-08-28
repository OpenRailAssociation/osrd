import type { RangedValue } from 'common/types';

/**
 * Ranges on the path Lille Flandres - Perpignan with a 2N2
 */
export const pathElectrificationRanges: RangedValue[] = [
  {
    begin: 0,
    end: 636293,
    value: '25000V',
  },
  {
    begin: 636293,
    end: 826794,
    value: '1500V',
  },
  {
    begin: 826794,
    end: 890963,
    value: '25000V',
  },
  {
    begin: 890963,
    end: 1115651,
    value: '1500V',
  },
];

export const validPowerRestrictionRanges: RangedValue[] = [
  {
    begin: 0,
    end: 636293,
    value: 'M1US',
  },
  {
    begin: 636293,
    end: 826794,
    value: 'C1US',
  },
  {
    begin: 826794,
    end: 890963,
    value: 'M3US',
  },
  {
    begin: 890963,
    end: 1115651,
    value: 'C2US',
  },
];

export const powerRestrictionRangesOnlyNoCode: RangedValue[] = [
  {
    begin: 0,
    end: 636293,
    value: 'NO_POWER_RESTRICTION',
  },
  {
    begin: 636293,
    end: 826794,
    value: 'NO_POWER_RESTRICTION',
  },
  {
    begin: 826794,
    end: 890963,
    value: 'NO_POWER_RESTRICTION',
  },
  {
    begin: 890963,
    end: 1115651,
    value: 'NO_POWER_RESTRICTION',
  },
];

export const powerRestrictionRangesMixedIn2Keys: RangedValue[] = [
  {
    begin: 0,
    end: 636293,
    value: 'C3US',
  },
  {
    begin: 636293,
    end: 826794,
    value: 'NO_POWER_RESTRICTION',
  },
  {
    begin: 826794,
    end: 890963,
    value: 'C3US',
  },
  {
    begin: 890963,
    end: 1115651,
    value: 'NO_POWER_RESTRICTION',
  },
];

export const powerRestrictionRangesWithValidRanges: RangedValue[] = [
  {
    begin: 0,
    end: 636293,
    value: 'M3US',
  },
  {
    begin: 636293,
    end: 826794,
    value: 'M1US',
  },
  {
    begin: 826794,
    end: 890963,
    value: 'C1US',
  },
  {
    begin: 890963,
    end: 1115651,
    value: 'C2US',
  },
];
