import { flatMap } from 'lodash';

import { EditorSchema } from 'types';

import {
  InfraErrorLevel,
  InfraErrorTypeLabel,
} from 'applications/editor/components/InfraErrors/types';

import { InfraState } from 'reducers/infra';

export interface EditorState extends InfraState {
  editorSchema: EditorSchema;
  editorLayers: Set<LayerType>;
  issues: {
    total: number;
    filterTotal: number;
    filterLevel: NonNullable<InfraErrorLevel>;
    filterType: InfraErrorTypeLabel | null;
  };
}

export const LAYERS = [
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
] as const;
export const LAYERS_SET: Set<string> = new Set(LAYERS);
export type LayerType = (typeof LAYERS)[number];

export const EDITOAST_TYPES = [
  'BufferStop',
  'Electrification',
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
  Electrification: ['electrifications'],
  Detector: ['detectors'],
  Route: ['routes'],
  Signal: ['signals'],
  SpeedSection: ['speed_sections', 'psl', 'psl_signs'],
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

export enum OPERATION_TYPE {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
}
