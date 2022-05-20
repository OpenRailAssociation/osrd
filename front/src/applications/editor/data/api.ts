import { Feature } from 'geojson';
import { omit } from 'lodash';
import { v4 as uuid } from 'uuid';

import { get, post } from '../../../common/requests';
import { Zone, EditorSchema, EditorEntity, ApiInfrastructure } from '../../../types';
import { zoneToBBox } from '../../../utils/mapboxHelper';
import { getObjectTypeForLayer } from './utils';

/**
 * Call the API to get an infra
 */
export async function getInfrastructure(id: number): Promise<ApiInfrastructure> {
  const response = await get(`/editoast/infra/${id}/`);
  return response;
}

/**
 * Call the API to get the list of infra
 */
export async function getInfrastructures(): Promise<Array<ApiInfrastructure>> {
  const response = await get(`/editoast/infra/`);
  return response;
}

/**
 * Call the API to get the definition of entities by layer.
 */
export async function getEditorSchema(): Promise<EditorSchema> {
  const schemaResponse = await fetch('/editor-json-schema.json').then((response) =>
    response.json()
  );
  const fieldToOmit = ['id', 'geo', 'sch'];
  const result = Object.keys(schemaResponse.properties)
    .filter((e) => schemaResponse.properties[e].type === 'array')
    .map((e) => {
      // we assume here, that the definition of the object is ref and not inline
      const ref = schemaResponse.properties[e].items.$ref.split('/');
      const refTarget = schemaResponse[ref[1]][ref[2]];
      refTarget.properties = omit(refTarget.properties, fieldToOmit);
      refTarget.required = (refTarget.required || []).filter(
        (field) => !fieldToOmit.includes(field)
      );

      return {
        layer: e,
        objType: ref[2],
        schema: {
          ...refTarget,
          [ref[1]]: schemaResponse[ref[1]],
        },
      } as EditorSchema[0];
    });
  return result;
}

/**
 * Call the API for geojson.
 */
export async function getEditorData(
  schema: EditorSchema,
  infra: number,
  layers: Array<string>,
  zone: Zone
): Promise<Array<EditorEntity>> {
  const bbox = zoneToBBox(zone);
  const responses = await Promise.all(
    layers.map(async (layer) => {
      const objType = getObjectTypeForLayer(schema, layer);
      const result = await get(
        `/layer/${layer}/objects/geo/${bbox[0]}/${bbox[1]}/${bbox[2]}/${bbox[3]}/?infra=${infra}`,
        {}
      );
      return result.features.map((f) => ({ ...f, id: f.properties.id, objType }));
    })
  );
  return responses.flat();
}

/**
 * Call the API to update the database.
 */
export async function editorSave(
  infra: number,
  operations: {
    create?: Array<EditorEntity>;
    update?: Array<EditorEntity>;
    delete?: Array<EditorEntity>;
  }
): Promise<Array<Feature>> {
  const payload = [
    ...(operations.create || []).map((feature) => ({
      operation_type: 'CREATE',
      obj_type: feature.objType,
      railjson: { id: uuid(), geo: feature.geometry, sch: feature.geometry, ...feature.properties },
    })),
    ...(operations.update || []).map((feature) => ({
      operation_type: 'UPDATE',
      obj_id: feature.id,
      obj_type: feature.objType,
      railjson_patch: feature.properties,
    })),
    ...(operations.delete || []).map((feature) => ({
      operation_type: 'DELETE',
      obj_id: feature.id,
      obj_type: feature.objType,
    })),
  ];

  try {
    const result = await post(`/editoast/infra/${infra}`, payload, {});
    return result;
  } catch (e) {
    throw e;
  }
}
