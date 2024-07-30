import { flatMap } from 'lodash';

import type { ObjectType } from 'common/api/osrdEditoastApi';

export const NON_EDITABLE_OBJECT_TYPES: ObjectType[] = [
  'OperationalPoint',
  'NeutralSection',
] as const;

// LAYERS

const INFRA_EDITOR_LAYERS = [
  'buffer_stops',
  'electrifications',
  'detectors',
  'errors',
  'psl',
  'psl_signs',
  'routes',
  'signals',
  'speed_sections',
  'track_nodes',
  'track_sections',
  'platforms',
  'neutral_sections',
  'operational_points',
] as const;
export const LAYERS_SET: Set<string> = new Set(INFRA_EDITOR_LAYERS);
export type Layer = (typeof INFRA_EDITOR_LAYERS)[number];

export const EDITOAST_TYPES = [
  'BufferStop',
  'Electrification',
  'Detector',
  'Route',
  'Signal',
  'SpeedSection',
  'TrackNode',
  'TrackSection',
  'NeutralSection',
  'OperationalPoint',
] as const;
export type EditoastType = (typeof EDITOAST_TYPES)[number];

export const EDITOAST_TO_LAYER_DICT: Record<EditoastType, Layer[]> = {
  BufferStop: ['buffer_stops'],
  Electrification: ['electrifications'],
  Detector: ['detectors'],
  Route: ['routes'],
  Signal: ['signals'],
  SpeedSection: ['speed_sections', 'psl', 'psl_signs'],
  TrackNode: ['track_nodes'],
  TrackSection: ['track_sections'],
  NeutralSection: ['neutral_sections'],
  OperationalPoint: ['operational_points'],
};
export const LAYER_TO_EDITOAST_DICT = flatMap(EDITOAST_TO_LAYER_DICT, (values, key) =>
  values.map((value) => [value, key])
).reduce(
  (iter, [value, key]) => ({
    ...iter,
    [value]: key,
  }),
  {}
) as Record<Layer, EditoastType>;

export enum OPERATION_TYPE {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
}
