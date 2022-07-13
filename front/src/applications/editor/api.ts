import { GeoJSON } from 'geojson';
import { get } from '../../common/requests';
import { ChartisAction, Zone } from '../../types';
import { zoneToFeature } from '../../utils/mapboxHelper';

/**
 * Call the chartis API for geojson.
 */
export async function getChartisLayers(zone: Zone, layers: Array<String>): Promise<Array<GeoJSON>> {
  const geoJson = zoneToFeature(zone, true);
  return await Promise.all(
    layers.map((layer) =>
      get(
        `/layer/${layer}/geojson/geo`,
        {
          bbox: geoJson.geometry,
          no_pagination: true,
          srid: 4326,
        },
        true
      )
    )
  );
}

/**
 * Call the chartis API to update the database.
 */
// TODO: this is just a fake method to simulate the save action.
// Must be implemented
export async function saveChartisActions(action: ChartisAction): Promise<void> {
  return await new Promise((resolve, reject) => {
    setTimeout(() => {
      /*Math.random() < 0.5 ? reject(new Error('A random error')) : */ resolve();
    }, 3000);
  });
}
