import { flatMap } from 'lodash';

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
  'switches',
  'track_sections',
  'platforms',
  'neutral_sections',
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
  'Switch',
  'TrackSection',
  'NeutralSection',
] as const;
export type EditoastType = (typeof EDITOAST_TYPES)[number];

export const EDITOAST_TO_LAYER_DICT: Record<EditoastType, Layer[]> = {
  BufferStop: ['buffer_stops'],
  Electrification: ['electrifications'],
  Detector: ['detectors'],
  Route: ['routes'],
  Signal: ['signals'],
  SpeedSection: ['speed_sections', 'psl', 'psl_signs'],
  Switch: ['switches'],
  TrackSection: ['track_sections'],
  NeutralSection: ['neutral_sections'],
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
