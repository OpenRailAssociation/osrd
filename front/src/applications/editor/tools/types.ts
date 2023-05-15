import { flatMap } from 'lodash';

import { EditorSchema } from '../../../types';

export interface EditorState {
  editorSchema: EditorSchema;
  editorLayers: Set<LayerType>;
}

export const LAYERS = [
  'track_sections',
  'signals',
  'buffer_stops',
  'detectors',
  'switches',
  'routes',
  'speed_sections',
  'errors',
  'lpv',
  'lpv_panels',
] as const;
export const LAYERS_SET: Set<string> = new Set(LAYERS);
export type LayerType = (typeof LAYERS)[number];

export const EDITOAST_TYPES = [
  'TrackSection',
  'Signal',
  'BufferStop',
  'Detector',
  'Switch',
  'Route',
  'SpeedSection',
] as const;
export const EDITOAST_TYPES_SET: Set<string> = new Set(EDITOAST_TYPES);
export type EditoastType = (typeof EDITOAST_TYPES)[number];

export const EDITOAST_TO_LAYER_DICT: Record<EditoastType, LayerType[]> = {
  TrackSection: ['track_sections'],
  Signal: ['signals'],
  BufferStop: ['buffer_stops'],
  Detector: ['detectors'],
  Switch: ['switches'],
  Route: ['routes'],
  SpeedSection: ['speed_sections', 'lpv', 'lpv_panels'],
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
