import along from '@turf/along';
import type { Position } from 'geojson';

import type { CorePropertyGeometryProjection, GeoJsonLineString } from 'common/api/osrdEditoastApi';
import { interpolateTopoAndGeomOffsets } from 'utils/geometry';

/**
 * Compute the coordinates of a point on a path from its path offset
 * the path's geometry and the path's topological to geometric projection
 */
const getPointOnPathCoordinates = (
  geometry: GeoJsonLineString,
  geomProjection: CorePropertyGeometryProjection,
  positionOnPath: number
): Position => {
  const geomOffset = interpolateTopoAndGeomOffsets(geomProjection, 'topo_to_geom', positionOnPath);
  return along(geometry, geomOffset, { units: 'millimeters' }).geometry.coordinates;
};

export default getPointOnPathCoordinates;
