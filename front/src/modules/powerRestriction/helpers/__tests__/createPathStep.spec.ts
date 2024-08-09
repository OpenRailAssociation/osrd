import type { TrackRange } from 'common/api/osrdEditoastApi';

import { findTrackSectionOffset } from '../createPathStep';

describe('findTrackOffset', () => {
  it('should correctly find the track offset', () => {
    const trackRangesLengthCumulativeSums = [1000, 2000, 3000, 4000, 5000];
    const trackRanges = [
      { track_section: 'track_0' },
      { track_section: 'track_1' },
      { track_section: 'track_2', begin: 0, end: 1000, direction: 'START_TO_STOP' },
      { track_section: 'track_3' },
      { track_section: 'track_4' },
    ] as TrackRange[];

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
    ] as TrackRange[];

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
    ] as TrackRange[];

    const offsetOnPath = 2010;
    const result = findTrackSectionOffset(
      offsetOnPath,
      trackRangesLengthCumulativeSums,
      trackRanges
    );

    expect(result).toEqual({ track: 'track_2', offset: 1050 });
  });

  it('should not find the track offset if past cumulative sums', () => {
    const trackRangesLengthCumulativeSums = [1000, 2000, 3000];
    const trackRanges = [
      { track_section: 'track_0' },
      { track_section: 'track_1' },
      { track_section: 'track_2' },
    ] as TrackRange[];

    const offsetOnPath = 3001;
    const result = findTrackSectionOffset(
      offsetOnPath,
      trackRangesLengthCumulativeSums,
      trackRanges
    );

    expect(result).toEqual(null);
  });
});
