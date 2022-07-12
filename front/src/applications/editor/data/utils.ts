import { Position } from 'geojson';
import { JSONSchema7 } from 'json-schema';
import { UiSchema } from '@rjsf/core';

import { EditorEntity, EditorSchema } from '../../../types';

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

/**
 * Given a JSON schema, returns its ui schema.
 * For now it's an empty object
 */
export function getJsonSchemaUi(_schema: JSONSchema7): UiSchema {
  return {};
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

export function getSymbolTypes(editorData: EditorEntity[]): string[] {
  const SIGNAL_TYPE_KEY = 'installation_type';
  return Object.keys(
    editorData.reduce(
      (iter, feature) =>
        feature.objType === 'Signal' && (feature.properties || {})[SIGNAL_TYPE_KEY]
          ? { ...iter, [(feature.properties || {})[SIGNAL_TYPE_KEY]]: true }
          : iter,
      {}
    )
  ).map(cleanSymbolType);
}

export function getAngle(p1: Position | undefined, p2: Position | undefined): number {
  if (!Array.isArray(p1) || !Array.isArray(p2)) return 0;
  const [x1, y1] = p1;
  const [x2, y2] = p2;
  return (Math.atan((x2 - x1) / (y2 - y1)) * 180) / Math.PI;
}
