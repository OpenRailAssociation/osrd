import { SwitchType } from 'types';
import { ValueOf } from 'utils/types';
import { Position, Feature, Point } from 'geojson';

export const BLOCKTYPES = [
  {
    key: 'BAL',
    value: 'BAL',
  },
  {
    key: 'BAPR',
    value: 'BAPR',
  },
  {
    key: 'ERTMS',
    value: 'ERTMS 3.4.0',
  },
  {
    key: 'TVM300',
    value: 'TVM 300',
  },
  {
    key: 'TVM430',
    value: 'TVM 430',
  },
];

export const SNCFCOLORS = {
  blue: '#0088ce',
  purple: '#6e1e78',
  pink: '#a1006b',
  red: '#cd0037',
  redassistance: '#d52b1e',
  orange: '#e05206',
  yellow: '#ffb612',
  green: '#82be00',
  teal: '#d2e100',
  cyan: '#009aa6',
  carbon: '#333333',
  gray: '#343a40',
  coolgray11: '#4d4f53',
  coolgray9: '#747678',
  coolgray7: '#a0a0a0',
  coolgray5: '#b9b9b9',
  coolgray3: '#d7d7d7',
  coolgray1: '#f2f2f2',
};

export const SNCFCOLORSONLY = {
  blue: '#0088ce',
  purple: '#6e1e78',
  pink: '#a1006b',
  red: '#cd0037',
  redassistance: '#d52b1e',
  orange: '#e05206',
  yellow: '#ffb612',
  green: '#82be00',
  teal: '#d2e100',
  cyan: '#009aa6',
  carbon: '#333333',
};

export const DUMMYCONST = null;

export const MANAGE_TRAIN_SCHEDULE_TYPES = Object.freeze({
  none: 'NONE',
  add: 'ADD',
  update: 'UPDATE',
});

export const MODES = Object.freeze({
  simulation: 'SIMULATION',
  stdcm: 'STDCM',
});

export const DEFAULT_MODE = MODES.simulation;

export const STDCM_MODES = Object.freeze({
  byOrigin: Symbol('BY_ORIGIN'),
  byDestination: Symbol('BY_DESTINATION'),
});

export const DEFAULT_STDCM_MODE = STDCM_MODES.byOrigin;

export const STDCM_REQUEST_STATUS = Object.freeze({
  idle: 'IDLE',
  pending: 'PENDING',
  success: 'SUCCESS',
  rejected: 'REJECTED',
  canceled: 'CANCELED',
  noresults: 'NORESULTS',
});

export interface PointOnMap {
  id: string;
  name?: string;
  curves: string;
  length: number;
  slopes: string;
  extensions_sncf_line_code: number;
  extensions_sncf_line_name: string;
  extensions_sncf_track_name: string;
  extensions_sncf_track_number: number;
  loading_gauge_limits: string;
  source: string;
  clickLngLat: Position;
  duration?: number;
}

export interface SuggestedPointOnMap {
  track: string;
  position: number;
  geo: Feature<Point>;
  sch: Feature<Point>;
  id: any;
  name: any;
  suggestion: boolean;
  duration: number;
}

export interface OsrdConfState {
  rollingStockComfort: any;
  name: string;
  mode: ValueOf<typeof MODES>;
  stdcmMode: ValueOf<typeof STDCM_MODES>;
  labels: string[];
  infraID?: number;
  switchTypes?: SwitchType[];
  pathfindingID?: number;
  timetableID?: number;
  rollingStockID?: number;
  speedLimitByTag?: any;
  origin?: PointOnMap;
  originSpeed: number;
  destination?: PointOnMap;
  vias: PointOnMap[];
  suggeredVias: SuggestedPointOnMap[];
  trainCompo: undefined;
  geojson: any[];
  originDate?: string;
  originTime?: string;
  originUpperBoundDate?: string;
  originUpperBoundTime?: string;
  originLinkedBounds: boolean;
  destinationDate?: string;
  destinationTime?: string;
  featureInfoClick: { displayPopup: boolean; feature?: Feature; coordinates?: number[] };
  gridMarginBefore: number;
  gridMarginAfter: number;
  standardStdcmAllowance: any; // We wait for auto generated types
}
