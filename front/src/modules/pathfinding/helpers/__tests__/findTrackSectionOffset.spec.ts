import { describe, it, expect } from 'vitest';

import type { CoreTrackRange } from 'common/api/osrdEditoastApi';

import findTrackSectionOffset from '../findTrackSectionOffset';

describe('findTrackSectionOffset', () => {
  it('should correctly find the track offset', () => {
    const trackRangesLengthCumulativeSums = [1000, 2000, 3000, 4000, 5000];
    const trackRanges = [
      { track_section: 'track_0' },
      { track_section: 'track_1' },
      { track_section: 'track_2', begin: 0, end: 1000, direction: 'START_TO_STOP' },
      { track_section: 'track_3' },
      { track_section: 'track_4' },
    ] as CoreTrackRange[];

    const offsetOnPath = 2060;
    const result = findTrackSectionOffset(
      offsetOnPath,
      trackRangesLengthCumulativeSums,
      trackRanges
    );

    expect(result).toEqual({ track: 'track_2', offset: 60 });
  });

  it('should correctly find the track offset if the track range does not cover the whole track section', () => {
    const trackRangesLengthCumulativeSums = [1000, 2000, 3000, 4000, 5000];
    const trackRanges = [
      { track_section: 'track_0' },
      { track_section: 'track_1' },
      { track_section: 'track_2', begin: 600, end: 1600, direction: 'START_TO_STOP' },
      { track_section: 'track_3' },
      { track_section: 'track_4' },
    ] as CoreTrackRange[];

    const offsetOnPath = 2300;
    const result = findTrackSectionOffset(
      offsetOnPath,
      trackRangesLengthCumulativeSums,
      trackRanges
    );

    expect(result).toEqual({ track: 'track_2', offset: 900 });
  });

  it('should correctly find the track offset if the track range direction is STOP_TO_START', () => {
    const trackRangesLengthCumulativeSums = [1000, 2000, 3000, 4000, 5000];
    const trackRanges = [
      { track_section: 'track_0' },
      { track_section: 'track_1' },
      { track_section: 'track_2', begin: 60, end: 1060, direction: 'STOP_TO_START' },
      { track_section: 'track_3' },
      { track_section: 'track_4' },
    ] as CoreTrackRange[];

    const offsetOnPath = 2010;
    const result = findTrackSectionOffset(
      offsetOnPath,
      trackRangesLengthCumulativeSums,
      trackRanges
    );

    expect(result).toEqual({ track: 'track_2', offset: 1050 });
  });

  it('should throw an error if the given position on path is beyond the last position of the path', () => {
    const trackRangesLengthCumulativeSums = [1000, 2000, 3000];
    const trackRanges = [
      { track_section: 'track_0' },
      { track_section: 'track_1' },
      { track_section: 'track_2' },
    ] as CoreTrackRange[];

    const offsetOnPath = 3001;

    expect(() =>
      findTrackSectionOffset(offsetOnPath, trackRangesLengthCumulativeSums, trackRanges)
    ).toThrow('No track range found for the given position on path');
  });

  it('should correctly find the track offset if it is located on the first track range', () => {
    const trackRangesLengthCumulativeSums = [1000, 2000, 3000, 4000, 5000];
    const trackRanges = [
      { track_section: 'track_0', begin: 500, end: 1500, direction: 'START_TO_STOP' },
      { track_section: 'track_1' },
      { track_section: 'track_2', begin: 60, end: 1060, direction: 'STOP_TO_START' },
      { track_section: 'track_3' },
      { track_section: 'track_4' },
    ] as CoreTrackRange[];

    const offsetOnPath = 900;
    const result = findTrackSectionOffset(
      offsetOnPath,
      trackRangesLengthCumulativeSums,
      trackRanges
    );

    expect(result).toEqual({ track: 'track_0', offset: 1400 });
  });
});
