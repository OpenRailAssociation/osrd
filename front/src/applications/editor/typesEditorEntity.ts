import type { Feature, GeoJsonProperties, Geometry } from 'geojson';
import type { JSONSchema7 } from 'json-schema';

import type { ObjectType } from 'common/api/osrdEditoastApi';

// EDITOR ENTITIES

export type EditorSchema = Array<{ layer: string; objType: ObjectType; schema: JSONSchema7 }>;
export type EditorEntity<G extends Geometry | null = Geometry, P = GeoJsonProperties> = Omit<
  Feature<G, P & { id: string }> & { objType: ObjectType },
  'id'
>;
