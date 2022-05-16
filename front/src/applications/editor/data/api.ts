import { Feature } from 'geojson';

import { get } from '../../../common/requests';
import { Zone, EditorSchema, ApiInfrastructure } from '../../../types';
import { zoneToBBox } from '../../../utils/mapboxHelper';

/**
 * Call the API to get an infra
 */
export async function getInfrastructure(id: number): Promise<ApiInfrastructure> {
  const response = await get(`/infra/${id}/`);
  return response;
}
/**
 * Call the API to get the list of infra
 */
export async function getInfrastructures(): Promise<Array<ApiInfrastructure>> {
  const response = await get(`/infra/`);
  return response;
}

/**
 * Call the API to get the definition of entities and components
 */
export function getEditorSchema(): Promise<EditorSchema> {
  return fetch('/editor-json-schema.json').then((response) => response.json());
}

/**
 * Call the API for geojson.
 */
export async function getEditorData(
  infra: number,
  layers: Array<string>,
  zone: Zone
): Promise<{ [layer: string]: Array<Feature> }> {
  const bbox = zoneToBBox(zone);
  const responses = await Promise.all(
    layers.map(async (layer) => {
      const result = await get(
        `/layer/${layer}/objects/geo/${bbox[0]}/${bbox[1]}/${bbox[2]}/${bbox[3]}/?infra=${infra}`,
        {}
      );
      return {
        layer,
        data: result.features.map((f) => ({ ...f, id: f.properties.id })),
      };
    })
  );
  const result = responses.reduce(
    (acc, current) => ({ ...acc, [current.layer]: current.data }),
    {} as { [layer: string]: Array<Feature> }
  );
  return result;
}

/**
 * Call the API to update the database.
 */
export async function editorSave(infra: number, entities: Array<Feature>): Promise<Array<Feature>> {
  console.log('TODO', infra, entities);
  // TODO
  return [];
}
