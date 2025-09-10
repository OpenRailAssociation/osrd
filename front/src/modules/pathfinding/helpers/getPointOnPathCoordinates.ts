import type { Position } from 'geojson';

import type { CoreTrackRange, TrackSection } from 'common/api/osrdEditoastApi';
import { getPointOnTrackCoordinates } from 'utils/geometry';
import { mToMm } from 'utils/physics';

import findTrackSectionOffset from './findTrackSectionOffset';

/**
 * Compute the coordinates of a point on a path from its path offset
 * and the list of tracks (track sections and ranges) composing the path.
 */
const getPointOnPathCoordinates = (
  tracks: Record<string, TrackSection>,
  trackRanges: CoreTrackRange[],
  tracksLengthCumulativeSums: number[],
  positionOnPath: number
): Position => {
  const trackOffset = findTrackSectionOffset(
    positionOnPath,
    tracksLengthCumulativeSums,
    trackRanges
  );

  const track = tracks[trackOffset.track];

  return getPointOnTrackCoordinates(track.geo, mToMm(track.length), trackOffset.offset);
};

export default getPointOnPathCoordinates;
