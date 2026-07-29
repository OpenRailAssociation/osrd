import { v4 as uuidV4 } from 'uuid';
import { describe, it, expect } from 'vitest';

import {
  mergeElectrificationAndProfiles,
  isScheduledPointsNotHonored,
  isTooFast,
  transformBoundariesDataToPositionDataArray,
  transformElectricalBoundariesToRanges,
  sortPathOperationalPoints,
} from 'applications/operationalStudies/utils';
import type { PathItem } from 'common/api/osrdEditoastApi';
import type { PathWaypoint } from 'modules/simulationResult/types';

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
    const result = isTooFast(trainSummaryTooFast);
    expect(result).toBe(true);
  });

  it('should return true if the train is too fast on an interval only', () => {
    // Case where the final time at C is higher than the provisional time at C,
    // and the final time at B is higher than the provisional time at B,
    // but the final travel time from B to C is lower than the provisional travel time from B to C.
    const result = isTooFast(trainSummaryTooFastOnInterval);
    expect(result).toBe(true);
  });

  it('should return false if the train is not too fast', () => {
    const result = isTooFast(trainSummaryHonored);
    expect(result).toBe(false);
  });
});

describe('isScheduledPointsNotHonored', () => {
  it('should return true if the train schedule is not honored', () => {
    const result = isScheduledPointsNotHonored(trainSummaryNotHonored);
    expect(result).toBe(true);
  });

  it('should return false if the train schedule is honored', () => {
    const result = isScheduledPointsNotHonored(trainSummaryHonored);
    expect(result).toBe(false);
  });
});

describe('sortPathOperationalPoints', () => {
  const makeOp = (pathItemId: string, position: number) =>
    ({ waypointId: uuidV4(), pathItemId, position }) as PathWaypoint;

  const makePathItem = (id: string): PathItem => ({
    id,
    location: {
      type: 'operational_point_part_reference',
      operational_point: { type: 'id', operational_point: uuidV4() },
    },
  });

  it('should not modify a list already sorted by position', () => {
    const ops = [makeOp('A', 0), makeOp('B', 100), makeOp('C', 200)];
    const path = [makePathItem('A'), makePathItem('B'), makePathItem('C')];
    const result = sortPathOperationalPoints(ops, path);
    expect(result.map((op) => op.pathItemId)).toEqual(['A', 'B', 'C']);
  });

  it('should put the path origin first in the list when its position matches the one of other waypoints', () => {
    const ops = [makeOp('A', 0), makeOp('C', 0), makeOp('B', 0), makeOp('D', 200)];
    const path = [makePathItem('C'), makePathItem('A'), makePathItem('D')];
    const result = sortPathOperationalPoints(ops, path);
    expect(result.map((op) => op.pathItemId)).toEqual(['C', 'A', 'B', 'D']);
  });

  it('should sort two path items based on their index in the path if they are next to each other in ops when they are neither the origin or destination)', () => {
    const ops = [
      makeOp('A', 0),
      makeOp('C', 200),
      makeOp('D', 200),
      makeOp('B', 200),
      makeOp('E', 200),
      makeOp('F', 300),
    ];
    const path = [makePathItem('A'), makePathItem('B'), makePathItem('D'), makePathItem('F')];
    const result = sortPathOperationalPoints(ops, path);
    expect(result.map((op) => op.pathItemId)).toEqual(['A', 'C', 'B', 'D', 'E', 'F']);
  });

  it('should put the path destination at the end of the list when its position matches the one of other waypoints', () => {
    const ops = [makeOp('A', 0), makeOp('D', 100), makeOp('B', 100), makeOp('C', 100)];
    const path = [makePathItem('A'), makePathItem('C'), makePathItem('D')];
    const result = sortPathOperationalPoints(ops, path);
    expect(result.map((op) => op.pathItemId)).toEqual(['A', 'B', 'C', 'D']);
  });
});
