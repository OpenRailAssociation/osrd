import { groupBy, uniq, toPairs } from 'lodash';

import type { EditoastType } from 'applications/editor/consts';
import type { EditorEntity } from 'applications/editor/typesEditorEntity';
import {
  type PostInfraByInfraIdObjectsAndObjectTypeApiResponse,
  osrdEditoastApi,
} from 'common/api/osrdEditoastApi';
import type { AppDispatch } from 'store';

export function editoastToEditorEntity<T extends EditorEntity = EditorEntity>(
  entity: PostInfraByInfraIdObjectsAndObjectTypeApiResponse[0],
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
 * Returns a list of entities from editoast
 */
export async function getEntities<T extends EditorEntity = EditorEntity>(
  infraId: number,
  ids: string[],
  type: T['objType'],
  dispatch: AppDispatch
): Promise<Record<string, T>> {
  const uniqIDs = uniq(ids);
  const results = await dispatch(
    osrdEditoastApi.endpoints.postInfraByInfraIdObjectsAndObjectType.initiate({
      infraId,
      objectType: type,
      body: uniqIDs,
    })
  ).unwrap();

  return results.reduce(
    (iter, entry, i) => ({
      ...iter,
      [uniqIDs[i]]: editoastToEditorEntity<T>(entry, type),
    }),
    {}
  );
}

/**
 * Returns an entity from editoast:
 */
export async function getEntity<T extends EditorEntity = EditorEntity>(
  infra: number,
  id: string,
  type: T['objType'],
  dispatch: AppDispatch
) {
  const result = await getEntities<T>(infra, [id], type, dispatch);
  if (!result || !result[id])
    throw new Error(`getEntity: No entity found for type ${type} and id ${id}`);

  return result[id];
}

export async function getMixedEntities<T extends EditorEntity = EditorEntity>(
  infra: number,
  defs: { id: string; type: EditoastType }[],
  dispatch: AppDispatch
) {
  const groupedDefs = groupBy(defs, 'type');

  const entities = await Promise.all(
    toPairs(groupedDefs).map(([type, values]) => {
      const ids = values.map(({ id }) => id);
      return getEntities<T>(infra, ids, type as EditoastType, dispatch);
    })
  );

  return entities.reduce((acc, curr) => ({ ...acc, ...curr }), {} as Record<string, T>);
}
