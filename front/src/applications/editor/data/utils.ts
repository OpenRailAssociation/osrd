import bearing from '@turf/bearing';
import { compare } from 'fast-json-patch';
import type { Position } from 'geojson';
import type { JSONSchema7 } from 'json-schema';
import { isArray, isNil, isObject, uniq } from 'lodash';
import { v4 as uuid } from 'uuid';

import type { EditoastType } from 'applications/editor/consts';
import type { CreateOperation, DeleteOperation, UpdateOperation } from 'applications/editor/types';
import type { EditorEntity, EditorSchema } from 'applications/editor/typesEditorEntity';
import type { PostInfraByInfraIdObjectsAndObjectTypeApiResponse } from 'common/api/osrdEditoastApi';
import {
  ALL_SIGNAL_LAYERS_SET,
  SIGNALS_TO_SYMBOLS,
  type SignalType,
} from 'common/Map/Consts/SignalsNames';

// Quick helper to get a "promised" setTimeout:
export function setTimeoutPromise(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export const NEW_ENTITY_ID = 'osrd/editor/new-signal-id';

export function getObjectTypeForLayer(schema: EditorSchema, layer: string): string | undefined {
  const item = schema.find((e) => e.layer === layer);
  return item ? item.objType : undefined;
}

export function getJsonSchemaForLayer(
  schema: EditorSchema,
  layer: string
): JSONSchema7 | undefined {
  const item = schema.find((e) => e.layer === layer);
  return item ? item.schema : undefined;
}

export function getJsonSchemaForObjectType(
  schema: EditorSchema,
  objType: string
): JSONSchema7 | undefined {
  const item = schema.find((e) => e.objType === objType);
  return item ? item.schema : undefined;
}

export function getLayerForObjectType(schema: EditorSchema, objType: string): string | undefined {
  const item = schema.find((e) => e.objType === objType);
  return item ? item.layer : undefined;
}

/**
 * This helper is here because types have excess quotes in GeoJSON for unknown
 * reasons:
 */
export function cleanSymbolType(type: string): string {
  return (type || '').replace(/(^[" ]|[" ]$)/g, '');
}

export function getSignalsList(editorData: EditorEntity[]): SignalType[] {
  const SIGNAL_TYPE_KEY = 'extensions_sncf_installation_type';
  const signalTypes = Object.keys(
    editorData.reduce(
      (iter, feature) =>
        feature.objType === 'Signal' && (feature.properties || {})[SIGNAL_TYPE_KEY]
          ? { ...iter, [(feature.properties || {})[SIGNAL_TYPE_KEY]]: true }
          : iter,
      {}
    )
  ).map(cleanSymbolType);

  return signalTypes.filter((signal: string): signal is SignalType => {
    if (ALL_SIGNAL_LAYERS_SET.has(signal)) return true;
    console.warn(`The signal type "${signal}" is not handled yet.`);
    return false;
  });
}
export function getSymbolsList(editorData: EditorEntity[]): SignalType[] {
  const signalTypes = getSignalsList(editorData);
  return uniq(signalTypes.flatMap((s) => SIGNALS_TO_SYMBOLS[s]));
}

export function getAngle(p1: Position | undefined, p2: Position | undefined): number {
  if (!Array.isArray(p1) || !Array.isArray(p2)) return 0;
  return bearing(p1, p2);
}

/**
 * This function recursively flattens an object, merging paths with a given separator.
 */
function flatten(
  input: unknown,
  separator: string,
  collection: Record<string, unknown>,
  prefix: string
): unknown {
  if (!isObject(input) || isNil(input)) {
    collection[prefix] = input;
    return collection[prefix];
  }

  if (isArray(input)) {
    collection[prefix] = JSON.stringify(input);
    return collection[prefix];
  }

  const object = input as Record<string, unknown>;
  Object.keys(object).forEach((key) => {
    flatten(object[key], separator, collection, (prefix ? prefix + separator : '') + key);
  });

  return collection;
}
export function flattenEntity(entity: EditorEntity): EditorEntity {
  return {
    ...entity,
    properties: flatten(entity.properties, '_', {}, '') as EditorEntity['properties'],
  };
}

/**
 * This function nests an object, splitting paths with a given separator.
 */
export function nestEntity(entity: EditorEntity, type: EditoastType): EditorEntity {
  const oldProperties = entity.properties;
  const newProperties = {} as EditorEntity['properties'];
  const separator = '_';

  Object.keys(oldProperties).forEach((key) => {
    const path = key.split(separator);
    path.reduce((props, k, i, a) => {
      const isLast = i === a.length - 1;

      if (isLast) props[k] = oldProperties[key];
      else props[k] = props[k] || {};
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return props[k];
    }, newProperties);
  });

  return {
    ...entity,
    objType: type,
    properties: newProperties,
  };
}

export function entityToCreateOperation(entity: EditorEntity): CreateOperation {
  return {
    operation_type: 'CREATE',
    obj_type: entity.objType,
    railjson: {
      ...entity.properties,
      id: uuid(),
    },
  } as CreateOperation;
}
export function entityToUpdateOperation(entity: EditorEntity, prev: EditorEntity): UpdateOperation {
  return {
    operation_type: 'UPDATE',
    obj_id: entity.properties.id,
    obj_type: prev.objType,
    railjson_patch: compare(
      prev.properties || {},
      entity.properties || {}
      // the "as" is mandatory due to the json patch lib that has the not standard "_get" operation
    ) as UpdateOperation['railjson_patch'],
  };
}
export function entityToDeleteOperation(entity: EditorEntity): DeleteOperation {
  return {
    operation_type: 'DELETE',
    obj_id: entity.properties.id,
    obj_type: entity.objType,
  };
}

export function editoastToEditorEntity<T extends EditorEntity = EditorEntity>(
  entity: Omit<PostInfraByInfraIdObjectsAndObjectTypeApiResponse[0], 'obj_id'>,
  type: T['objType']
): T {
  return {
    type: 'Feature',
    properties: entity.railjson,
    objType: type,
    geometry: entity.geographic,
  } as T;
}
