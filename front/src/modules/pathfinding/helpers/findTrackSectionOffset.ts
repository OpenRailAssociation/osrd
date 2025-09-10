import type { CoreTrackRange } from 'common/api/osrdEditoastApi';

/**
 * Return the track offset corresponding to the given position on path, composed of the track section id
 * and the offset on this track section in mm
 */
const findTrackSectionOffset = (
  positionOnPath: number, // in mm
  tracksLengthCumulativeSums: number[], // in mm
  trackRangesOnPath: CoreTrackRange[]
) => {
  const index = tracksLengthCumulativeSums.findIndex(
    (cumulativeSum) => positionOnPath <= cumulativeSum
  );
  const trackRange = trackRangesOnPath[index];

  if (!trackRange) {
    throw new Error('No track range found for the given position on path');
  }

  // compute offset
  const inferiorSum = index > 0 ? tracksLengthCumulativeSums[index - 1] : 0;
  const offsetOnTrackRange = positionOnPath - inferiorSum;
  const offsetOnTrackSection =
    trackRange.direction === 'START_TO_STOP'
      ? trackRange.begin + offsetOnTrackRange
      : trackRange.end - offsetOnTrackRange;

  return { track: trackRange.track_section, offset: offsetOnTrackSection };
};

export default findTrackSectionOffset;
