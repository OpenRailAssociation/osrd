import { GeoJSON } from 'geojson';
import { JSONSchema7 } from 'json-schema';
import { get } from '../../common/requests';
import { EditorAction, Zone, EditorComponentsDefintion, EditorModelsDefinition } from '../../types';
import { zoneToFeature } from '../../utils/mapboxHelper';

/**
 * Call the API for geojson.
 */
export async function getEditorLayers(
  infra: number,
  layers: Array<String>,
  zone: Zone,
): Promise<Array<GeoJSON>> {
  const geoJson = zoneToFeature(zone, true);
  return await Promise.all(
    layers.map((layer) =>
      get(
        `/chartis/layer/${layer}/geojson/geo/`,
        {
          version: infra,
          bbox: geoJson.geometry,
          no_pagination: true,
          srid: 4326,
        },
        true,
      ),
    ),
  );
}

type ApiSchemaResponseEntity = {
  entity_name: string;
  components: Array<string>;
};
type ApiSchemaResponseComponent = {
  component_name: string;
  fields: Array<string>;
};
type ApiSchemaResponse = {
  entities: Array<ApiSchemaResponseEntity>;
  components: Array<ApiSchemaResponseComponent>;
};

/**
 * Call the API to get the definition of model and components
 */
export async function getEditorModelDefinition(): Promise<{
  components: EditorComponentsDefintion;
  entities: EditorModelsDefinition;
}> {
  const result: {
    components: EditorComponentsDefintion;
    entities: EditorModelsDefinition;
  } = {
    components: {},
    entities: {},
  };
  const data: ApiSchemaResponse = await get('/osrd/schema/', {}, true);

  // parse the response and build the result
  data.entities.forEach((entity: ApiSchemaResponseEntity) => {
    result.entities[entity.entity_name] = entity.components;
  });
  data.components.forEach((component: ApiSchemaResponseComponent) => {
    const jsonSchema: JSONSchema7 = {
      type: 'object',
      properties: {},
    };
    component.fields.forEach((name: string) => {
      jsonSchema[name] = { type: 'string' };
    });
    result.components[component.component_name] = jsonSchema;
  });
  return result;
}

/**
 * Call the API to update the database.
 */
// TODO: this is just a fake method to simulate the save action.
// Must be implemented
export async function saveEditorActions(infra: number, action: EditorAction): Promise<void> {
  return await new Promise((resolve, reject) => {
    setTimeout(() => {
      /* Math.random() < 0.5 ? reject(new Error('A random error')) : */ resolve();
    }, 3000);
  });
}
