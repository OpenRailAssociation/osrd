import { EditorSchema } from '../../../types';
import { JSONSchema7 } from 'json-schema';

export function getObjectTypeForLayer(schema: EditorSchema, layer: string): string | undefined {
  return schema[layer] ? schema[layer].objType : undefined;
}

export function getJsonSchemaForLayer(
  schema: EditorSchema,
  layer: string
): JSONSchema7 | undefined {
  return schema[layer] ? schema[layer].schema : undefined;
}

export function getLayerForObjectType(schema: EditorSchema, objType: string): string | undefined {
  const result = Object.keys(schema)
    .map((layer) => ({ layer, objType: schema[layer].objType }))
    .filter((e) => e.objType === objType);
  return result && result[0] ? result[0].layer : undefined;
}
