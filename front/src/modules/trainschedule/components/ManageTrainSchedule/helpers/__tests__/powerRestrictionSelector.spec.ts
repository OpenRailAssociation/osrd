import type { Dictionary } from 'lodash';

import type { PowerRestrictionWarning } from 'modules/trainschedule/components/ManageTrainSchedule/types';

import {
  pathElectrificationRanges,
  powerRestrictionRangesMixedIn2Keys,
  powerRestrictionRangesOnlyNoCode,
  powerRestrictionRangesWithValidRanges,
  rollingStockModes,
  validPowerRestrictionRanges,
} from './sampleData';
import { countWarnings, getPowerRestrictionsWarnings } from '../powerRestrictionSelector';

describe('getPowerRestrictionsWarnings', () => {
  it('should return an empty object if there is no warning', () => {
    const warnings = getPowerRestrictionsWarnings(
      validPowerRestrictionRanges,
      pathElectrificationRanges,
      rollingStockModes
    );

    expect(warnings).toEqual({});
  });

  it('should return an object with only one key if there is no power restriction selected', () => {
    const warnings = getPowerRestrictionsWarnings(
      powerRestrictionRangesOnlyNoCode,
      pathElectrificationRanges,
      rollingStockModes
    );

    const expectedResult: Dictionary<PowerRestrictionWarning[]> = {
      NO_POWER_RESTRICTION: [
        {
          powerRestrictionCode: 'NO_POWER_RESTRICTION',
          begin: 0,
          end: 636293,
        },
        {
          powerRestrictionCode: 'NO_POWER_RESTRICTION',
          begin: 636293,
          end: 826794,
        },
        {
          powerRestrictionCode: 'NO_POWER_RESTRICTION',
          begin: 826794,
          end: 890963,
        },
        {
          powerRestrictionCode: 'NO_POWER_RESTRICTION',
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

    const expectedResult = {
      C3US: [
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
      NO_POWER_RESTRICTION: [
        {
          powerRestrictionCode: 'NO_POWER_RESTRICTION',
          begin: 636293,
          end: 826794,
        },
        {
          powerRestrictionCode: 'NO_POWER_RESTRICTION',
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
      M1US: [
        {
          powerRestrictionCode: 'M1US',
          electrification: '1500V',
          begin: 636293,
          end: 826794,
        },
      ],
      C1US: [
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
