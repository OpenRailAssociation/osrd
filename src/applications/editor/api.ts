import bboxPolygon from '@turf/bbox-polygon';
import { GeoJSON, Position } from 'geojson';
import { get } from '../../common/requests';
import { ChartisAction } from '../../types';

/**
 * Call the chartis API for geojson.
 */
export async function getChartisLayers(
  bbox: [Position, Position],
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

/**
 * Call the chartis API to update the database.
 */
// TODO: this is just a fake method to simulate the save action.
// Must be implemented
export async function saveChartisActions(action: ChartisAction): Promise<void> {
  return await new Promise((resolve, reject) => {
    setTimeout(() => {
      Math.random() < 0.5 ? reject(new Error('A random error')) : resolve();
    }, 3000);
  });
}
