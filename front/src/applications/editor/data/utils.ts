import { Position } from 'geojson';
import { JSONSchema7 } from 'json-schema';
import { isArray, isNil, isObject, uniq, defaultTo, isEqual, mapValues, pickBy } from 'lodash';
import bearing from '@turf/bearing';
import { compare } from 'fast-json-patch';
import { v4 as uuid } from 'uuid';
import { TFunction } from 'i18next';
import { RJSFSchema } from '@rjsf/utils';

import { EditorEntity, EditorSchema } from '../../../types';
import {
  ALL_SIGNAL_LAYERS_SET,
  SIGNALS_TO_SYMBOLS,
  SignalType,
} from '../../../common/Map/Consts/SignalsNames';
import {
  DeleteOperation,
  UpdateOperation,
  RailjsonObject,
  PostInfraByIdObjectsAndObjectTypeApiResponse,
} from '../../../common/api/osrdEditoastApi';
import { EditoastType } from '../tools/types';

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
      return props[k];
    }, newProperties);
  });

  return {
    ...entity,
    objType: type,
    properties: newProperties,
  };
}

export function entityToCreateOperation(entity: EditorEntity): RailjsonObject {
  return {
    operation_type: 'CREATE',
    obj_type: entity.objType,
    railjson: {
      ...entity.properties,
      id: uuid(),
    },
  };
}
export function entityToUpdateOperation(entity: EditorEntity, prev: EditorEntity): UpdateOperation {
  return {
    operation_type: 'UPDATE',
    obj_id: prev.properties.id,
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
  entity: PostInfraByIdObjectsAndObjectTypeApiResponse[0],
  type: T['objType']
): T {
  return {
    type: 'Feature',
    properties: entity.railjson,
    objType: type,
    geometry: entity.geographic,
  } as T;
}

const getTypeScope = (scope: string, typeName: string) => `${scope}.types.${typeName}`;
const getPropScope = (scope: string, propName: string) => `${scope}.fields.${propName}`;
const translateIfExist = (i18n: TFunction, key: string, defaultValue?: string) => {
  const value = i18n(key, { nsSeparator: false });
  if (value !== key && !isObject(value)) return value;
  if (import.meta.env.DEV) console.debug(`Missing i18n key ${key}`);
  return defaultValue;
};
export function localizedJsonSchema(
  schema: RJSFSchema,
  i18n: TFunction,
  scope: string
): RJSFSchema {
  const newSchema: RJSFSchema = {
    ...schema,
    ...pickBy({
      title: translateIfExist(i18n, `${scope}.title`, schema.title),
      description: translateIfExist(i18n, `${scope}.description`, schema.description),
      help: translateIfExist(i18n, `${scope}.help`, schema.help),
    }),
  };

  if (schema.definitions) {
    newSchema.definitions = mapValues(schema.definitions, (typeSchema, typeName) =>
      localizedJsonSchema(typeSchema as JSONSchema7, i18n, getTypeScope(scope, typeName))
    );
  }

  if (schema.type === 'object') {
    newSchema.properties = mapValues(schema.properties, (propSchema, propName) =>
      localizedJsonSchema(propSchema as JSONSchema7, i18n, getPropScope(scope, propName))
    );
  }

  if (schema.enum && (!schema.enumNames || isEqual(schema.enum, schema.enumNames))) {
    newSchema.enumNames = schema.enum.map((option) =>
      defaultTo(
        translateIfExist(i18n, `${scope}.options.${option}`),
        option ? `${option}` : undefined
      )
    );
  }

  if (schema.items && schema.type === 'array') {
    if ((schema.items as RJSFSchema).enum && !(schema.items as RJSFSchema).enumNames) {
      newSchema.items = {
        ...(newSchema.items as RJSFSchema),
        enumNames: (schema.items as RJSFSchema).enum?.map((option) =>
          translateIfExist(i18n, `${scope}.options.${option}`, option ? `${option}` : undefined)
        ),
      } as RJSFSchema;
    } else if (
      (schema.items as RJSFSchema).properties &&
      (schema.items as RJSFSchema).type === 'object'
    ) {
      newSchema.items = {
        ...(newSchema.items as RJSFSchema),
        properties: mapValues((schema.items as RJSFSchema).properties, (propSchema, propName) =>
          localizedJsonSchema(propSchema as RJSFSchema, i18n, getPropScope(scope, propName))
        ),
      };
    }
  }

  return newSchema;
}
