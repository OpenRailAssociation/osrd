import { describe, it, expect } from 'vitest';

import type { PowerRestrictionWarnings } from 'modules/powerRestriction/types';

import {
  pathElectrificationRanges,
  powerRestrictionRangesMixedIn2Keys,
  powerRestrictionRangesOnlyNoCode,
  powerRestrictionRangesWithValidRanges,
  rollingStockModes,
  validPowerRestrictionRanges,
} from './sampleData';
import { countWarnings, getPowerRestrictionsWarnings } from '../powerRestrictionWarnings';

const emptyResult: PowerRestrictionWarnings = {
  invalidCombinationWarnings: [],
  modeNotSupportedWarnings: [],
  missingPowerRestrictionWarnings: [],
};

describe('getPowerRestrictionsWarnings', () => {
  it('should return an empty object if there is no warning', () => {
    const warnings = getPowerRestrictionsWarnings(
      validPowerRestrictionRanges,
      pathElectrificationRanges,
      rollingStockModes
    );

    expect(warnings).toEqual(emptyResult);
  });

  it('should return an object with only one key if there is no power restriction selected', () => {
    const warnings = getPowerRestrictionsWarnings(
      powerRestrictionRangesOnlyNoCode,
      pathElectrificationRanges,
      rollingStockModes
    );

    const expectedResult: PowerRestrictionWarnings = {
      ...emptyResult,
      missingPowerRestrictionWarnings: [
        {
          begin: 0,
          end: 636293,
        },
        {
          begin: 636293,
          end: 826794,
        },
        {
          begin: 826794,
          end: 890963,
        },
        {
          begin: 890963,
          end: 1115651,
        },
      ],
    };

    expect(warnings).toEqual(expectedResult);
  });

  it('should return an object with 4 warnings distributed in 2 keys if warnings are a combination of one power restriction code two times and no power restriction code two times', () => {
    const warnings = getPowerRestrictionsWarnings(
      powerRestrictionRangesMixedIn2Keys,
      pathElectrificationRanges,
      rollingStockModes
    );

    const expectedResult: PowerRestrictionWarnings = {
      ...emptyResult,
      invalidCombinationWarnings: [
        {
          powerRestrictionCode: 'C3US',
          electrification: '25000V',
          begin: 0,
          end: 636293,
        },
        {
          powerRestrictionCode: 'C3US',
          electrification: '25000V',
          begin: 826794,
          end: 890963,
        },
      ],
      missingPowerRestrictionWarnings: [
        {
          begin: 636293,
          end: 826794,
        },
        {
          begin: 890963,
          end: 1115651,
        },
      ],
    };

    expect(warnings).toEqual(expectedResult);
  });

  it('should return an object with 2 warnings distributed in 2 keys if 2 different power restrictions code are invalid', () => {
    const warnings = getPowerRestrictionsWarnings(
      powerRestrictionRangesWithValidRanges,
      pathElectrificationRanges,
      rollingStockModes
    );

    const expectedResult = {
      ...emptyResult,
      invalidCombinationWarnings: [
        {
          powerRestrictionCode: 'M1US',
          electrification: '1500V',
          begin: 636293,
          end: 826794,
        },
        {
          powerRestrictionCode: 'C1US',
          electrification: '25000V',
          begin: 826794,
          end: 890963,
        },
      ],
    };

    expect(warnings).toEqual(expectedResult);
  });

  describe('should handle the case where the train passes on a segment in 1500V but handles only 25000V', () => {
    const simplePathElectrificationRanges = [
      {
        begin: 0,
        end: 10000,
        value: '25000V',
      },
    ];
    const rollintStockModesWithout25000V = {
      '1500V': rollingStockModes['1500V'],
    };

    it('should return no warning if the mode is not supported and no power restriction is defined', () => {
      const emptyPowerRestrictionRanges = [
        {
          begin: 0,
          end: 10000,
          value: 'NO_POWER_RESTRICTION',
        },
      ];
      const warnings = getPowerRestrictionsWarnings(
        emptyPowerRestrictionRanges,
        simplePathElectrificationRanges,
        rollintStockModesWithout25000V
      );

      expect(warnings).toEqual(emptyResult);
    });

    it('should return a warning if the mode is not supported and a power restriction is defined', () => {
      const simplePowerRestrictionRanges = [
        {
          begin: 0,
          end: 10000,
          value: 'C1UM',
        },
      ];
      const warnings = getPowerRestrictionsWarnings(
        simplePowerRestrictionRanges,
        simplePathElectrificationRanges,
        rollintStockModesWithout25000V
      );

      const expectedResult = {
        ...emptyResult,
        modeNotSupportedWarnings: [
          {
            electrification: '25000V',
            begin: 0,
            end: 10000,
          },
        ],
      };
      expect(warnings).toEqual(expectedResult);
    });
  });
});

describe('countWarnings', () => {
  it('should return 0 if no warnings are detected', () => {
    const warnings = getPowerRestrictionsWarnings(
      validPowerRestrictionRanges,
      pathElectrificationRanges,
      rollingStockModes
    );

    const totalWarnings = countWarnings(warnings);

    expect(totalWarnings).toEqual(0);
  });
  it('should properly count all warnings when they are all in the same key', () => {
    const warnings = getPowerRestrictionsWarnings(
      powerRestrictionRangesOnlyNoCode,
      pathElectrificationRanges,
      rollingStockModes
    );

    const totalWarnings = countWarnings(warnings);

    expect(totalWarnings).toEqual(4);
  });
  it('should properly count all warnings when they are in multiple keys', () => {
    const warnings = getPowerRestrictionsWarnings(
      powerRestrictionRangesMixedIn2Keys,
      pathElectrificationRanges,
      rollingStockModes
    );

    const totalWarnings = countWarnings(warnings);

    expect(totalWarnings).toEqual(4);
  });
  it('should properly count all warnings when they are in multiple keys and some ranges are valid', () => {
    const warnings = getPowerRestrictionsWarnings(
      powerRestrictionRangesWithValidRanges,
      pathElectrificationRanges,
      rollingStockModes
    );

    const totalWarnings = countWarnings(warnings);

    expect(totalWarnings).toEqual(2);
  });
});
