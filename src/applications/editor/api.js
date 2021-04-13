import bboxPolygon from '@turf/bbox-polygon';
import { get } from '../../common/requests';

/**
 * Call the chartis API for geojson.
 *
 * @param {[[number, number], [number, number]]} bbox  The selected bbox (NO/SE).
 * @param {String[]} layers  List of layer's slug to call
 * @return {GeoJSON[]}
 */
export async function getGeoJson(bbox, layers) {
  const geoJson = bboxPolygon(bbox.flat());
  console.log('bbox', bbox, geoJson);
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
