import {
  formatElectrificationRanges,
  isScheduledPointsNotHonored,
  isTooFast,
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
  trainScheduleHonored,
  trainScheduleNoMatch,
  trainScheduleNoSchedule,
  trainScheduleNotHonored,
  trainScheduleTooFast,
  trainSummaryHonored,
  trainSummaryNotHonored,
  trainSummaryTooFast,
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

describe('isTooFast', () => {
  it('should return true if the train is too fast', () => {
    const result = isTooFast(trainScheduleTooFast, trainSummaryTooFast);
    expect(result).toBe(true);
  });

  it('should return false if the train is not too fast', () => {
    const result = isTooFast(trainScheduleHonored, trainSummaryHonored);
    expect(result).toBe(false);
  });
});

describe('isScheduledPointsNotHonored', () => {
  it('should return true if the train schedule is not honored', () => {
    const result = isScheduledPointsNotHonored(trainScheduleNotHonored, trainSummaryNotHonored);
    expect(result).toBe(true);
  });

  it('should return false if the train schedule is honored', () => {
    const result = isScheduledPointsNotHonored(trainScheduleHonored, trainSummaryHonored);
    expect(result).toBe(false);
  });

  it('should return false if there is no schedule', () => {
    const result = isScheduledPointsNotHonored(trainScheduleNoSchedule, trainSummaryHonored);
    expect(result).toBe(false);
  });

  it('should throw an error if no matching index is found for a schedule', () => {
    expect(() => {
      isScheduledPointsNotHonored(trainScheduleNoMatch, trainSummaryHonored);
    }).toThrow();
  });
});
