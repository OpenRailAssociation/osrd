import {
  formatElectrificationRanges,
  transformBoundariesDataToPositionDataArray,
  transformBoundariesDataToRangesData,
} from 'applications/operationalStudies/utils';

import {
  boundariesDataWithElectrificalProfile,
  boundariesDataWithElectrification,
  boundariesDataWithNumber,
  electricalProfileRangesData,
  electricalProfileRangesDataShort,
  electrificationRanges,
  electrificationRangesData,
  electrificationRangesDataLarge,
  electrificationRangesLarge,
  getExpectedResultDataNumber,
  pathLength,
} from './sampleData';

describe('transformBoundariesDataToPositionDataArray', () => {
  it('should transform boundaries data to position data array for gradient', () => {
    const result = transformBoundariesDataToPositionDataArray(
      boundariesDataWithNumber,
      pathLength,
      'gradient'
    );

    expect(result).toEqual(getExpectedResultDataNumber('gradient'));
  });

  it('should transform boundaries data to position data array for radius', () => {
    const result = transformBoundariesDataToPositionDataArray(
      boundariesDataWithNumber,
      pathLength,
      'radius'
    );

    expect(result).toEqual(getExpectedResultDataNumber('radius'));
  });
});

describe('transformBoundariesDataToRangesData', () => {
  it('should transform boundaries data to ranges data for electrification', () => {
    const result = transformBoundariesDataToRangesData(
      boundariesDataWithElectrification,
      pathLength
    );

    expect(result).toEqual(electrificationRangesData);
  });

  it('should transform boundaries data to ranges data for electrical profile', () => {
    const result = transformBoundariesDataToRangesData(
      boundariesDataWithElectrificalProfile,
      pathLength
    );

    expect(result).toEqual(electricalProfileRangesData);
  });
});

describe('formatElectrificationRanges', () => {
  it('should properly format electrification ranges if both parameters have same length', () => {
    const result = formatElectrificationRanges(
      electrificationRangesData,
      electricalProfileRangesData
    );

    expect(result).toEqual(electrificationRanges);
  });

  it('should properly format electrification ranges if electrification is longer than electrical profiles', () => {
    const result = formatElectrificationRanges(
      electrificationRangesDataLarge,
      electricalProfileRangesDataShort
    );

    expect(result).toEqual(electrificationRangesLarge);
  });
});
