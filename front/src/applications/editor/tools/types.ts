import { flatMap } from 'lodash';

import { EditorSchema } from '../../../types';

export interface EditorState {
  editorSchema: EditorSchema;
  editorLayers: Set<LayerType>;
}

export const LAYERS = [
  'buffer_stops',
  'catenaries',
  'detectors',
  'errors',
  'lpv',
  'lpv_panels',
  'routes',
  'signals',
  'speed_sections',
  'switches',
  'track_sections',
] as const;
export const LAYERS_SET: Set<string> = new Set(LAYERS);
export type LayerType = (typeof LAYERS)[number];

export const EDITOAST_TYPES = [
  'BufferStop',
  'Catenary',
  'Detector',
  'Route',
  'Signal',
  'SpeedSection',
  'Switch',
  'TrackSection',
] as const;
export const EDITOAST_TYPES_SET: Set<string> = new Set(EDITOAST_TYPES);
export type EditoastType = (typeof EDITOAST_TYPES)[number];

export const EDITOAST_TO_LAYER_DICT: Record<EditoastType, LayerType[]> = {
  BufferStop: ['buffer_stops'],
  Catenary: ['catenaries'],
  Detector: ['detectors'],
  Route: ['routes'],
  Signal: ['signals'],
  SpeedSection: ['speed_sections', 'lpv', 'lpv_panels'],
  Switch: ['switches'],
  TrackSection: ['track_sections'],
};
export const LAYER_TO_EDITOAST_DICT = flatMap(EDITOAST_TO_LAYER_DICT, (values, key) =>
  values.map((value) => [value, key])
).reduce(
  (iter, [value, key]) => ({
    ...iter,
    [value]: key,
  }),
  {}
) as Record<LayerType, EditoastType>;
