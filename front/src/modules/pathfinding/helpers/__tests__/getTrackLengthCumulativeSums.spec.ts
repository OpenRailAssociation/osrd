import { describe, it, expect } from 'vitest';

import type { CoreTrackRange } from 'common/api/osrdEditoastApi';

import getTrackLengthCumulativeSums from '../getTrackLengthCumulativeSums';

describe('getTrackLengthCumulativeSums', () => {
  it('should return empty array for an empty input', () => {
    const trackRanges: CoreTrackRange[] = [];

    const result = getTrackLengthCumulativeSums(trackRanges);
    expect(result).toEqual([]);
  });

  it('should return the correct cumulative sums', () => {
    const trackRanges: CoreTrackRange[] = [
      { begin: 1000, end: 1500, direction: 'START_TO_STOP', track_section: 'a' },
      { begin: 0, end: 5000, direction: 'START_TO_STOP', track_section: 'b' },
    ];

    const result = getTrackLengthCumulativeSums(trackRanges);
    expect(result).toEqual([500, 5500]);
  });
});
