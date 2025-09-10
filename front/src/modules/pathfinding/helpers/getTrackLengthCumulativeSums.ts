import type { CoreTrackRange } from 'common/api/osrdEditoastApi';

/**
 * Given a list of track ranges, return the array of cumulative sums of the lengths of the track ranges.
 */
const getTrackLengthCumulativeSums = (trackRanges: CoreTrackRange[]): number[] => {
  const results: number[] = [];

  trackRanges.forEach((range, index) => {
    const rangeLength = Math.abs(range.end - range.begin);

    if (index === 0) {
      results.push(rangeLength);
    } else {
      results.push(results[results.length - 1] + rangeLength);
    }
  });

  return results;
};

export default getTrackLengthCumulativeSums;
