import { GeoJSON } from 'geojson';
import { JSONSchema7 } from 'json-schema';
import { get, post } from '../../common/requests';
import { EditorAction, Zone, EditorComponentsDefintion, EditorModelsDefinition } from '../../types';
import { zoneToFeature } from '../../utils/mapboxHelper';

type ApiInfrastructure = {
  id: number;
  name: string;
  owner: string;
  created: Date;
  modified: Date;
};

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
 * Call the API to get an infra
 */
export async function getInfrastructure(id: number): Promise<ApiInfrastructure> {
  const data = await get(`/osrd/infra/${id}`, {}, true);
  return {
    ...data,
    created: new Date(data.created),
    modified: new Date(data.modified),
  } as ApiInfrastructure;
}
/**
 * Call the API to get the list of infra
 */
export async function getInfrastructures(): Promise<Array<ApiInfrastructure>> {
  const data = await get(`/osrd/infra/`, {}, true);
  return data.results.map((infra: ApiInfrastructure) => {
    return {
      ...infra,
      created: new Date(data.created),
      modified: new Date(data.modified),
    };
  });
}

/**
 * Call the API to get the definition of entities and components
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
      jsonSchema.properties[name] = { type: 'string' };
    });
    result.components[component.component_name] = jsonSchema;
  });
  return result;
}

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

/**
 * Call the API to update the database.
 */
export async function saveEditorActions(
  infra: number,
  actions: Array<EditorAction>,
): Promise<void> {
  console.log(infra, actions);
  const data = await post(
    `/osrd/infra/${infra}/edit/`,
    actions.map((action) => ({
      operation: 'create_entity',
      entity_type: action.entity,
      components: action.data,
    })),
    {},
    true,
  );
  return data;
}
