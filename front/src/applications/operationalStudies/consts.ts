import i18n from 'i18n';
import { Position, Feature } from 'geojson';
import {
  AllowanceValue,
  RollingStockComfortType,
  ElectrificationRange,
  ElectrificationUsage,
  PathResponse,
  PowerRestrictionRangeItem,
} from 'common/api/osrdEditoastApi';
import { LinearMetadataItem } from 'common/IntervalsDataViz/types';
import { HeightPosition } from 'reducers/osrdsimulation/types';
import { AllowanceForm } from 'modules/trainschedule/components/ManageTrainSchedule/Allowances/types';
import { InfraState } from 'reducers/infra';

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
  edit: 'EDIT',
  import: 'IMPORT',
});

interface MODES_Types {
  [n: string]: string;
}

export const MODES: MODES_Types = Object.freeze({
  simulation: 'SIMULATION',
  stdcm: 'STDCM',
  editor: 'EDITOR',
  mapViewer: 'MAP_VIEWER',
});

export const DEFAULT_MODE = MODES.simulation;

export interface StandardAllowance {
  type: AllowanceValue['value_type'];
  value: number;
}

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

const STUDY_TYPES = {
  nothingSelected: 'nothingSelected',
  timeTables: 'timeTables',
  flowRate: 'flowRate',
  parkSizing: 'parkSizing',
  garageRequirement: 'garageRequirement',
  operationOrSizing: 'operationOrSizing',
  operability: 'operability',
  strategicPlanning: 'strategicPlanning',
  chartStability: 'chartStability',
  disturbanceTests: 'disturbanceTests',
};

export type StudyType = keyof typeof STUDY_TYPES;
export const studyTypes = Object.keys(STUDY_TYPES) as StudyType[];

export type PowerRestrictionRange = LinearMetadataItem<{ value: string }>;

export interface OsrdConfState extends InfraState {
  rollingStockComfort: RollingStockComfortType;
  name: string;
  trainCount: number;
  trainStep: number;
  trainDelta: number;
  allowances: AllowanceForm[];
  usingElectricalProfiles: boolean;
  labels: string[];
  projectID?: number;
  studyID?: number;
  scenarioID?: number;
  pathfindingID?: number;
  timetableID?: number;
  rollingStockID?: number;
  speedLimitByTag?: string;
  // TODO: update the call to the api, to rename the fields begin & end -> begin_position & end_position
  powerRestrictionRanges: PowerRestrictionRange[];
  origin?: PointOnMap;
  initialSpeed?: number;
  departureTime: string;
  destination?: PointOnMap;
  vias: PointOnMap[];
  suggeredVias: PathResponse['steps'] | PointOnMap[];
  geojson?: PathResponse;
  originDate?: string;
  originTime?: string;
  originUpperBoundDate?: string;
  originUpperBoundTime?: string;
  originLinkedBounds: boolean;
  destinationDate?: string;
  destinationTime?: string;
  gridMarginBefore?: number;
  gridMarginAfter?: number;
  trainScheduleIDsToModify: number[];
  featureInfoClick: { displayPopup: boolean; feature?: Feature; coordinates?: number[] };
}

export interface OsrdStdcmConfState extends OsrdConfState {
  maximumRunTime: number;
  standardStdcmAllowance?: StandardAllowance;
}

export const RUNTIME_CAP = 43200;

// electrical profiles
interface Profile {
  mode: string;
  color: string[];
  isStriped: boolean;
}

/** Those keys are used to index objects of type HeightPosition but also to access properties ending by
 * "_start" / "_middle" / "_end" in objects of type PowerRestrictionSegment in order to draw the linear graph. */
export const DRAWING_KEYS: (keyof HeightPosition)[] = ['position', 'height'];
export type DrawingKeys = typeof DRAWING_KEYS;

export interface ElectricalConditionSegment {
  position_start: number;
  position_end: number;
  position_middle: number;
  lastPosition: number;
  height_start: number;
  height_end: number;
  height_middle: number;
  electrification: ElectrificationUsage;
  seenRestriction?: string;
  usedRestriction?: string;
  color: string;
  textColor: string;
  text: string;
  isStriped: boolean;
  isIncompatibleElectricalProfile: boolean;
  isRestriction: boolean;
  isIncompatiblePowerRestriction: boolean;
}

interface AC {
  '25000V': string;
  '22500V': string;
  '20000V': string;
}
interface DC {
  O: string;
  A: string;
  A1: string;
  B: string;
  B1: string;
  C: string;
  D: string;
  E: string;
  F: string;
  G: string;
}

interface Mode {
  '25000V': AC | string;
  '1500V': DC | string;
  thermal: string;
  '15000V': string;
  '3000V': string;
}

const electricalProfileColorsWithProfile: Mode = {
  '25000V': { '25000V': '#6E1E78', '22500V': '#A453AD', '20000V': '#DD87E5' },
  '1500V': {
    O: '#FF0037',
    A: '#FF335F',
    A1: '#FF335F',
    B: '#FF6687',
    B1: '#FF6687',
    C: '#FF99AF',
    D: '#FF99AF',
    E: '#FFCCD7',
    F: '#FFCCD7',
    G: '#FFF',
  },
  thermal: '#333',
  '15000V': '#009AA6',
  '3000V': '#1FBE00',
};

const electricalProfileColorsWithoutProfile: Mode = {
  '25000V': '#6E1E78',
  '1500V': '#FF0037',
  thermal: '#333',
  '15000V': '#009AA6',
  '3000V': '#1FBE00',
};

export const legend: Profile[] = [
  { mode: '25000V', color: ['25KA', '25KB'], isStriped: false },
  { mode: '1500V', color: ['1500A', '1500B', '1500C'], isStriped: false },
  {
    mode: 'thermal',
    color: ['Thermal'],
    isStriped: false,
  },
  { mode: '15000V', color: ['15000V'], isStriped: false },
  { mode: '3000V', color: ['3000V'], isStriped: false },
  {
    mode: 'unused',
    color: ['noUsed'],
    isStriped: true,
  },
];

export const createProfileSegment = (
  fullElectrificationRange: ElectrificationRange[],
  electrificationRange: ElectrificationRange
) => {
  const electrification = electrificationRange.electrificationUsage;
  const segment: ElectricalConditionSegment = {
    position_start: electrificationRange.start,
    position_end: electrificationRange.stop,
    position_middle: (electrificationRange.start + electrificationRange.stop) / 2,
    lastPosition: fullElectrificationRange.slice(-1)[0].stop,
    height_start: 4,
    height_end: 24,
    height_middle: 14,
    electrification,
    color: '',
    textColor: '',
    text: '',
    isStriped: false,
    isIncompatibleElectricalProfile: false,
    isRestriction: false,
    isIncompatiblePowerRestriction: false,
  };

  // add colors to object depending of the type of electrification
  if (electrification.object_type === 'Electrified') {
    const { mode, mode_handled, profile, profile_handled } = electrification;
    segment.color =
      electricalProfileColorsWithProfile[mode as keyof unknown][
        electrification.profile as string
      ] || electricalProfileColorsWithoutProfile[mode as keyof unknown];

    segment.textColor = electricalProfileColorsWithoutProfile[mode as keyof unknown];

    if (!mode_handled) {
      // uncompatible mode
      segment.text = `${i18n.t('electricalProfiles.incompatibleMode', { ns: 'simulation' })}`;
    } else if (mode !== 'thermal') {
      // compatible electric mode (themal modes are not displayed)
      if (profile) {
        if (profile_handled) {
          // compatible electric mode, with compatible profile
          segment.text = `${mode} ${profile}`;
        } else {
          // compatible electric mode, with uncompatible profile
          segment.isIncompatibleElectricalProfile = true;
          segment.isStriped = true;
          segment.text = `${mode}, ${i18n.t('electricalProfiles.incompatibleProfile', {
            ns: 'simulation',
          })}`;
        }
      } else {
        // compatible electric mode, but missing profile
        segment.text = mode;
        segment.isStriped = true;
      }
    }
  } else if (electrification.object_type === 'Neutral') {
    segment.text = 'Neutral';
    segment.color = '#000000';
    segment.textColor = '#000000';
  } else {
    segment.text = 'NonElectrified';
    segment.color = '#000000';
    segment.textColor = '#000';
  }

  return segment;
};

export interface PowerRestrictionSegment {
  position_start: number;
  position_end: number;
  position_middle: number;
  lastPosition: number;
  height_start: number;
  height_end: number;
  height_middle: number;
  seenRestriction: string;
  usedRestriction: boolean;
  isStriped: boolean;
  isRestriction: boolean;
  isIncompatiblePowerRestriction: boolean;
}

export const createPowerRestrictionSegment = (
  fullPowerRestrictionRange: PowerRestrictionRangeItem[],
  powerRestrictionRange: PowerRestrictionRangeItem
) => {
  // figure out if the power restriction is incompatible or missing
  const isRestriction = powerRestrictionRange.handled;
  const isIncompatiblePowerRestriction =
    !!powerRestrictionRange.code && !powerRestrictionRange.handled;
  const isStriped = !!powerRestrictionRange.code && !powerRestrictionRange.handled;

  const segment: PowerRestrictionSegment = {
    position_start: powerRestrictionRange.start,
    position_end: powerRestrictionRange.stop,
    position_middle: (powerRestrictionRange.start + powerRestrictionRange.stop) / 2,
    lastPosition: fullPowerRestrictionRange.slice(-1)[0].stop,
    height_start: 4,
    height_end: 24,
    height_middle: 14,
    seenRestriction: powerRestrictionRange.code || '',
    usedRestriction: powerRestrictionRange.handled,
    isStriped,
    isRestriction,
    isIncompatiblePowerRestriction,
  };

  return segment;
};
