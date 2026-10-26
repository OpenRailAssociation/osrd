import along from '@turf/along';
import type { Position } from 'geojson';

import type { CorePropertyGeometryProjection, GeoJsonLineString } from 'common/api/osrdEditoastApi';
import { convertGeomTopoTrackOffset } from 'utils/geometry';

/**
 * Compute the coordinates of a point on a path from its path offset,
 * the path geometry and the path topological to geometric offset projection.
 */
const getPointOnPathCoordinates = (
  positionOnPath: number,
  geometry: GeoJsonLineString,
  geomProjection: CorePropertyGeometryProjection
): Position => {
  const geometricOffset = convertGeomTopoTrackOffset(
    geomProjection,
    positionOnPath,
    'topo_to_geom'
  );

  return along(geometry, geometricOffset, { units: 'millimeters' }).geometry.coordinates;
};

export default getPointOnPathCoordinates;
