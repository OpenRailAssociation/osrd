import { Position } from 'geojson';
import { JSONSchema7 } from 'json-schema';
import { at } from 'lodash';

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
  const SIGNAL_TYPE_KEY = ['extensions.sncf.installation_type'];
  return Object.keys(
    editorData.reduce((acc, feature) => {
      if (feature.objType === 'Signal') {
        const signal = at(feature.properties, SIGNAL_TYPE_KEY);
        if (signal && signal[0]) {
          return { ...acc, [signal[0]]: true };
        }
      }
      return acc;
    }, {})
  ).map(cleanSymbolType);
}

export function getAngle(p1: Position | undefined, p2: Position | undefined): number {
  if (!Array.isArray(p1) || !Array.isArray(p2)) return 0;
  const [x1, y1] = p1;
  const [x2, y2] = p2;
  return (Math.atan((x2 - x1) / (y2 - y1)) * 180) / Math.PI;
}
