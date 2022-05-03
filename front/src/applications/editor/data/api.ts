import { omit } from 'lodash';
import { JSONSchema7, JSONSchema7Definition } from 'json-schema';

import { get, post } from '../../../common/requests';
import {
  Zone,
  EditorModelsDefinition,
  EditorEntitiesDefinition,
  EditorComponentsDefinition,
  ApiInfrastructure,
  ApiSchemaResponse,
  ApiSchemaResponseEntity,
  ApiSchemaResponseComponent,
} from '../../../types';
import { zoneToFeature } from '../../../utils/mapboxHelper';
import { EntityBase, EntityModel } from './entity';
import i18n from '../../../i18n';

/**
 * Call the API to get an infra
 */
export async function getInfrastructure(id: number): Promise<ApiInfrastructure> {
  const data = await get(`/infra/${id}`);
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
  const data = await get('/infra/');
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
  components: EditorComponentsDefinition;
  entities: EditorModelsDefinition;
}> {
  const result: {
    components: EditorComponentsDefinition;
    entities: EditorModelsDefinition;
  } = {
    components: {},
    entities: {},
  };
  const data: ApiSchemaResponse = await get('/schema/');

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
        (field: { name: string; type: string }) => !['component_id', 'entity'].includes(field.name)
      )
      .forEach((field: { name: string; type: string }) => {
        jsonSchema.properties = jsonSchema.properties || {};
        jsonSchema.required = jsonSchema.required || [];

        const property: JSONSchema7Definition = {
          title: i18n.t(`Editor.entities.${component.component_name}-${field.name}`),
        };
        jsonSchema.properties[field.name] = property;
        switch (field.type) {
          case 'integer':
          case 'string':
            property.type = field.type;
            jsonSchema.required.push(field.name);
            break;
          case 'float':
            property.type = 'number';
            jsonSchema.required.push(field.name);
            break;
          // for PK
          default:
            property.type = 'integer';
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
  entitiesDefinition: EditorEntitiesDefinition | null,
  componentsDefinition: EditorComponentsDefinition | null
): Promise<Array<EntityModel>> {
  const geoJson = zoneToFeature(zone, true);
  const responses = await Promise.all(
    layers.map(() =>
      get(`/infra/${infra}/geojson/`, {
        query: geoJson.geometry,
      })
    )
  );
  return responses.flatMap((response) =>
    response.features.map(
      (obj: { properties: string | EntityBase }) =>
        new EntityModel(
          obj.properties,
          entitiesDefinition as EditorEntitiesDefinition,
          componentsDefinition as EditorComponentsDefinition
        )
    )
  );
}

/**
 * Call the API to update the database.
 */
export async function saveEditorEntities(
  infra: number,
  entities: Array<EntityModel>
): Promise<Array<EntityModel>> {
  const operations = entities.flatMap((entity: EntityModel) => entity.getOperations());
  const response = await post(
    `/infra/${infra}/edit/`,
    operations.map((operation) => {
      return operation.operation === 'create_entity' ? omit(operation, ['entity_id']) : operation;
    }),
    {}
  );

  // rebuild the entities list
  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~
  let newEntities = [...entities];

  // parse the response to add ids to new entities
  response.forEach(
    (result: { entity_id: number; component_ids: Record<number, number> }, index: number) => {
      const operation = operations[index];

      if (operation.operation === 'create_entity') {
        const entity = newEntities.find((e) => e.entity_id === operation.entity_id);
        if (!entity) return;

        entity.entity_id = result.entity_id;
        entity.components = entity.components.map((component, i) => ({
          ...component,
          component_id: result.component_ids[i],
        }));
        newEntities = newEntities.filter((e) => e.entity_id !== operation.entity_id);
        newEntities.push(entity);
      }

      if (operation.operation === 'delete_entity') {
        newEntities = newEntities.filter((e) => e.entity_id !== operation.entity_id);
      }
    }
  );

  return newEntities;
}
