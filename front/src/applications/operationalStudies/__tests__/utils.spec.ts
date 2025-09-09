import { describe, it, expect } from 'vitest';

import {
  mergeElectrificationAndProfiles,
  isScheduledPointsNotHonored,
  isTooFast,
  transformBoundariesDataToPositionDataArray,
  transformElectricalBoundariesToRanges,
} from 'applications/operationalStudies/utils';

import {
  boundariesDataWithNumber,
  electricalProfileBoundariesSingleSegment,
  electricalProfileBoundariesMatched,
  electricalProfileBoundariesMismatched,
  electrificationBoundariesSingleSegment,
  electrificationBoundariesMatched,
  electrificationBoundariesMismatched,
  electrificationRangesSingleSegment,
  electrificationRangesMatched,
  electrificationRangesMismatched,
  getExpectedResultDataNumber,
  mergedElectricalBoundariesSingleSegment,
  mergedElectricalBoundariesMatched,
  mergedElectricalBoundariesMismatched,
  pathLength,
  pathLengthLong,
  trainScheduleHonored,
  trainScheduleNoMatch,
  trainScheduleNoSchedule,
  trainScheduleNotHonored,
  trainScheduleTooFast,
  trainScheduleTooFastOnInterval,
  trainSummaryHonored,
  trainSummaryNotHonored,
  trainSummaryTooFast,
  trainSummaryTooFastOnInterval,
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

describe('mergeElectrificationAndProfiles', () => {
  it('should properly merge electrification and electrical profile boundaries if these boundaries are matched', () => {
    const result = mergeElectrificationAndProfiles(
      electrificationBoundariesMatched,
      electricalProfileBoundariesMatched
    );

    expect(result).toEqual(mergedElectricalBoundariesMatched);
  });

  it('should properly merge electrification and electrical profile boundaries if these boundaries are mismatched', () => {
    const result = mergeElectrificationAndProfiles(
      electrificationBoundariesMismatched,
      electricalProfileBoundariesMismatched
    );

    expect(result).toEqual(mergedElectricalBoundariesMismatched);
  });

  it('should properly merge electrification and electrical profile boundaries if both boundaries list are empty', () => {
    const result = mergeElectrificationAndProfiles(
      electrificationBoundariesSingleSegment,
      electricalProfileBoundariesSingleSegment
    );

    expect(result).toEqual(mergedElectricalBoundariesSingleSegment);
  });
});

describe('transformElectricalBoundariesToRanges', () => {
  it('should transform electrical boundaries to ranges (matched boundaries case)', () => {
    const result = transformElectricalBoundariesToRanges(
      mergedElectricalBoundariesMatched,
      pathLength
    );

    expect(result).toEqual(electrificationRangesMatched);
  });

  it('should transform electrical boundaries to ranges (mismatched boundaries case)', () => {
    const result = transformElectricalBoundariesToRanges(
      mergedElectricalBoundariesMismatched,
      pathLengthLong
    );

    expect(result).toEqual(electrificationRangesMismatched);
  });

  it('should transform merged boundaries to ranges for a single segment', () => {
    const result = transformElectricalBoundariesToRanges(
      mergedElectricalBoundariesSingleSegment,
      pathLength
    );

    expect(result).toEqual(electrificationRangesSingleSegment);
  });
});

describe('isTooFast', () => {
  it('should return true if the train is too fast', () => {
    const result = isTooFast(trainScheduleTooFast, trainSummaryTooFast);
    expect(result).toBe(true);
  });

  it('should return true if the train is too fast on an interval only', () => {
    // Case where the final time at C is higher than the provisional time at C,
    // and the final time at B is higher than the provisional time at B,
    // but the final travel time from B to C is lower than the provisional travel time from B to C.
    const result = isTooFast(trainScheduleTooFastOnInterval, trainSummaryTooFastOnInterval);
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
