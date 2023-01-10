import { groupBy, omit, uniq, toPairs } from 'lodash';
import { v4 as uuid } from 'uuid';
import { compare } from 'fast-json-patch';
import { FeatureCollection } from 'geojson';

import { get, post } from '../../../common/requests';
import {
  ApiInfrastructure,
  CreateEntityOperation,
  DeleteEntityOperation,
  EditorEntity,
  EditorSchema,
  EntityOperation,
  SwitchType,
  UpdateEntityOperation,
  Zone,
} from '../../../types';
import { zoneToBBox } from '../../../utils/mapboxHelper';
import { getObjectTypeForLayer } from './utils';
import { EditoastType } from '../tools/types';

/**
 * Call the API to get an infra
 */
export async function getInfrastructure(id: number): Promise<ApiInfrastructure> {
  return get(`/editoast/infra/${id}/`);
}

/**
 * Call the API to get the list of infra
 */
export async function getInfrastructures(): Promise<Array<ApiInfrastructure>> {
  return get(`/editoast/infra/`);
}

/**
 * Call the API to get the definition of entities by layer.
 */
export async function getEditorSchema(): Promise<EditorSchema> {
  const schemaResponse = await get('/infra/schema/');
  const fieldToOmit = ['id', 'geo', 'sch'];
  return Object.keys(schemaResponse.properties || {})
    .filter((e: string) => schemaResponse.properties[e].type === 'array')
    .map((e: string) => {
      // we assume here, that the definition of the object is ref and not inline
      const ref = schemaResponse.properties[e].items.$ref.split('/');
      const refTarget = schemaResponse[ref[1]][ref[2]];
      refTarget.properties = omit(refTarget.properties, fieldToOmit);
      refTarget.required = (refTarget.required || []).filter(
        (field: string) => !fieldToOmit.includes(field)
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
}

/**
 * Call the API for the list of switch types in a given infra.
 */
export async function getSwitchTypes(infra: number): Promise<SwitchType[]> {
  return get(`/editoast/infra/${infra}/switch_types`);
}

/**
 * Call the API for geojson.
 */
export async function getEditorData(
  schema: EditorSchema,
  infra: number,
  layers: Set<string>,
  zone: Zone
): Promise<Record<string, EditorEntity[]>> {
  const bbox = zoneToBBox(zone);
  const layersArray = Array.from(layers);
  const responses = await Promise.all(
    layersArray.map(async (layer) => {
      const objType = getObjectTypeForLayer(schema, layer);
      const result = await get<FeatureCollection>(
        `/layer/${layer}/objects/geo/${bbox[0]}/${bbox[1]}/${bbox[2]}/${bbox[3]}/?infra=${infra}`,
        {}
      );
      return result.features.map((f) => ({ ...f, objType }));
    })
  );

  return layersArray.reduce(
    (iter, layer, i) => ({
      ...iter,
      [layer]: responses[i],
    }),
    {}
  );
}

type EditoastEntity<T extends EditorEntity = EditorEntity> = {
  railjson: T['properties'];
  geographic: T['geometry'];
  schematic: T['geometry'];
};

function editoastToEditorEntity<T extends EditorEntity = EditorEntity>(
  entity: EditoastEntity,
  type: T['objType']
): T {
  return {
    type: 'Feature',
    properties: entity.railjson,
    objType: type,
    geometry: entity.geographic,
  } as T;
}

/**
 * Returns an entity from editoast:
 */
export async function getEntity<T extends EditorEntity = EditorEntity>(
  infra: number | string,
  id: string,
  type: EditoastType
): Promise<T> {
  const res = await post<string[], EditoastEntity<T>[]>(
    `/editoast/infra/${infra}/objects/${type}/`,
    [id]
  );

  if (res.length < 1) throw new Error(`getEntity: No entity found for type ${type} and id ${id}`);

  return editoastToEditorEntity<T>(res[0], type);
}
export async function getEntities<T extends EditorEntity = EditorEntity>(
  infra: number | string,
  ids: string[],
  type: EditoastType
): Promise<Record<string, T>> {
  const uniqIDs = uniq(ids);
  const res = await post<string[], EditoastEntity[]>(
    `/editoast/infra/${infra}/objects/${type}/`,
    uniqIDs
  );

  return res.reduce(
    (iter, entry, i) => ({
      ...iter,
      [uniqIDs[i]]: editoastToEditorEntity<T>(entry, type),
    }),
    {}
  );
}
export async function getMixedEntities(
  infra: number | string,
  defs: { id: string; type: EditoastType }[]
): Promise<Record<string, EditorEntity>> {
  const groupedDefs = groupBy(defs, 'type');

  const entities = await Promise.all(
    toPairs(groupedDefs).map(([type, values]) => {
      const ids = values.map(({ id }) => id);
      return getEntities(infra, ids, type as EditoastType);
    })
  );

  return entities.reduce((acc, curr) => ({ ...acc, ...curr }), {} as Record<string, EditorEntity>);
}

/**
 * Call the API to update the database.
 */
export async function editorSave(
  infra: number,
  operations: {
    create?: Array<EditorEntity>;
    update?: Array<{ source: EditorEntity; target: EditorEntity }>;
    delete?: Array<EditorEntity>;
  }
): Promise<Array<EditorEntity>> {
  const payload: EntityOperation[] = [
    ...(operations.create || []).map(
      (feature): CreateEntityOperation => ({
        operation_type: 'CREATE',
        obj_type: feature.objType,
        railjson: {
          ...feature.properties,
          id: uuid(),
        },
      })
    ),
    ...(operations.update || []).map(
      (features): UpdateEntityOperation => ({
        operation_type: 'UPDATE',
        obj_id: features.source.properties.id,
        obj_type: features.source.objType,
        railjson_patch: compare(features.source.properties || {}, features.target.properties || {}),
      })
    ),
    ...(operations.delete || []).map(
      (feature): DeleteEntityOperation => ({
        operation_type: 'DELETE',
        obj_id: feature.properties.id,
        obj_type: feature.objType,
      })
    ),
  ];

  return post<EntityOperation[], EditorEntity[]>(`/editoast/infra/${infra}`, payload, {});
}
