import type { Position } from 'geojson';

import type { CorePropertyGeometryProjection, GeoJsonMultiLineString } from 'common/api/osrdEditoastApi';
import { convertGeomTopoTrackOffset, getPointOnTracksCoordinates } from 'utils/geometry';

/**
 * Compute the coordinates of a point on a path from its path offset,
 * the path geometry and the path topological to geometric offset projection.
 */
const getPointOnPathCoordinates = (
  positionOnPath: number,
  geometry: GeoJsonMultiLineString,
  geomProjection: CorePropertyGeometryProjection
): Position => {
  const geometricOffset = convertGeomTopoTrackOffset(
    geomProjection,
    positionOnPath,
    'topo_to_geom'
  );

  return getPointOnTracksCoordinates(geometry, geometricOffset, positionOnPath)!
};

export default getPointOnPathCoordinates;
