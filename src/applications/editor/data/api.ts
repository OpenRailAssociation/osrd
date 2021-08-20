import { GeoJSON } from 'geojson';
import { JSONSchema7 } from 'json-schema';
import { get, post } from '../../../common/requests';
import {
  EditorOperation,
  Zone,
  EditorComponentsDefintion,
  EditorModelsDefinition,
} from '../../types';
import { zoneToFeature } from '../../../utils/mapboxHelper';
import { EntityModel } from './entity';
import i18n from './../../../i18n';

interface ApiInfrastructure {
  id: number;
  name: string;
  owner: string;
  created: Date;
  modified: Date;
}

interface ApiSchemaResponseEntity {
  entity_name: string;
  components: Array<string>;
}
interface ApiSchemaResponseComponent {
  component_name: string;
  fields: Array<{ name: string; type: string }>;
}
interface ApiSchemaResponse {
  entities: Array<ApiSchemaResponseEntity>;
  components: Array<ApiSchemaResponseComponent>;
}

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
      title: i18n.t(`Editor.entities.${component.component_name}`),
      properties: {},
      required: [],
    };
    component.fields
      .filter(
        (field: { name: string; type: string }) => !['component_id', 'entity'].includes(field.name),
      )
      .forEach((field: { name: string; type: string }) => {
        jsonSchema.properties[field.name] = {
          title: i18n.t(`Editor.entities.${component.component_name}-${field.name}`),
        };
        switch (field.type) {
          case 'integer':
          case 'string':
            jsonSchema.properties[field.name].type = field.type;
            jsonSchema.required.push(field.name);
            break;
          case 'float':
            jsonSchema.properties[field.name].type = 'number';
            jsonSchema.required.push(field.name);
            break;
          // for PK
          default:
            jsonSchema.properties[field.name].type = 'integer';
            break;
        }
      });
    result.components[component.component_name] = jsonSchema;
  });
  return result;
}

/**
 * Call the API for geojson.
 */
export async function getEditorEntities(
  infra: number,
  layers: Array<string>,
  zone: Zone,
  entitiesDefinintion: EditorEntitiesDefinition | null,
  componentsDefinition: EditorComponentsDefinition | null,
): Promise<Array<EntityModel>> {
  const geoJson = zoneToFeature(zone, true);
  const responses = await Promise.all(
    layers.map((layer) =>
      get(
        `/osrd/infra/${infra}/geojson`,
        {
          query: geoJson.geometry,
        },
        true,
      ),
    ),
  );
  return responses.flatMap((response) =>
    response.features.map(
      (obj) => new EntityModel(obj.properties, entitiesDefinintion, componentsDefinition),
    ),
  );
}

/**
 * Call the API to update the database.
 */
export async function saveEditorEntities(
  infra: number,
  entities: Array<EntityModel>,
): Promise<void> {
  const operations = entities.flatMap((entity: EntityModel) => entity.getOperations());
  return await post(`/osrd/infra/${infra}/edit/`, operations, {}, true);
}
