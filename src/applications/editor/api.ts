import bboxPolygon from '@turf/bbox-polygon';
import { GeoJSON } from 'geojson';
import { get } from '../../common/requests';

/**
 * Call the chartis API for geojson.
 */
export async function getGeoJson(
  bbox: [[number, number], [number, number]],
  layers: Array<String>,
): Promise<Array<GeoJSON>> {
  const geoJson = bboxPolygon(bbox.flat() as any);
  const result = await Promise.all(
    layers.map((layer) =>
      get(
        `/chartis/layer/${layer}/geojson/geo`,
        {
          bbox: geoJson.geometry,
          no_pagination: true,
          srid: 4326,
        },
        true,
      ),
    ),
  );
  return result;
}
