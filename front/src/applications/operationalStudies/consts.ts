import type { Position } from 'geojson';

import type { LinearMetadataItem } from 'common/IntervalsDataViz/types';

export const MANAGE_TRAIN_SCHEDULE_TYPES = Object.freeze({
  none: 'NONE',
  add: 'ADD',
  edit: 'EDIT',
  import: 'IMPORT',
});

export interface PointOnMap {
  id?: string;
  name?: string;
  curves?: string;
  length?: number;
  slopes?: string;
  extensions_sncf_line_code?: number;
  extensions_sncf_line_name?: string;
  extensions_sncf_track_name?: string;
  extensions_sncf_track_number?: number;
  loading_gauge_limits?: string;
  coordinates?: Position | number[];
  duration?: number;
  track?: string;
  position?: number;
  path_offset?: number;
  uic?: number | null;
  ch?: string | null;
  ci?: number | null;
  location?: {
    track_section?: string;
    offset?: number;
    geo_coordinates?: Position | number[];
  };
}

export const STUDY_STATES = {
  started: 'started',
  inProgress: 'inProgress',
  finish: 'finish',
};

export type StudyState = keyof typeof STUDY_STATES;
export const studyStates = Object.keys(STUDY_STATES) as StudyState[];

export const STUDY_TYPES = [
  'nothingSelected',
  'timeTables',
  'flowRate',
  'parkSizing',
  'garageRequirement',
  'operationOrSizing',
  'operability',
  'strategicPlanning',
  'chartStability',
  'disturbanceTests',
] as const;

export type StudyType = typeof STUDY_TYPES;

export type PowerRestrictionRange = LinearMetadataItem<{ value: string }>;
