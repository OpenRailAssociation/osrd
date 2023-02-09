import { SwitchType } from 'types';
import { ValueOf } from 'utils/types';
import { Position, Feature } from 'geojson';
import { Path } from 'common/api/osrdMiddlewareApi';
import { ModesAndProfiles } from 'reducers/osrdsimulation/types';

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
  track?: string;
}

export interface OsrdConfState {
  rollingStockComfort: any;
  name: string;
  mode: ValueOf<typeof MODES>;
  stdcmMode: ValueOf<typeof STDCM_MODES>;
  labels: string[];
  projectID?: number;
  studyID?: number;
  scenarioID?: number;
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
  suggeredVias: Path['steps'];
  trainCompo: undefined;
  geojson?: Path;
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

// electrical profiles
export interface ElecProfileProps {
  isActive: boolean;
  setIsActive: Function;
}
interface Profile {
  mode: string;
  color: string[];
  isStriped: boolean;
}

interface Segment {
  position_start: number;
  position_end: number;
  position_middle: number;
  lastPosition: number;
  height_start: number;
  height_end: number;
  height_middle: number;
  usedMode: string;
  usedProfile: string;
  color: string;
  textColor: string;
  text: string;
  isStriped: boolean;
  isIncompatible: boolean;
}

interface AC {
  25000: string;
  22500: string;
  20000: string;
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
  25000: AC | string;
  1500: DC | string;
  thermal: string;
  15000: string;
  3000: string;
}

export const legend: Profile[] = [
  { mode: '25000', color: ['25KA', '25KB'], isStriped: false },
  { mode: '1500', color: ['1500A', '1500B', '1500C'], isStriped: false },
  {
    mode: 'thermal',
    color: ['Thermal'],
    isStriped: false,
  },
  { mode: '15000', color: ['15000'], isStriped: false },
  { mode: '3000', color: ['3000'], isStriped: false },
  {
    mode: 'unused',
    color: ['noUsed'],
    isStriped: true,
  },
];

export const createProfileSegment = (
  fullModesAndProfiles: ModesAndProfiles[],
  modeAndProfile: ModesAndProfiles
) => {
  let segment: Segment = {
    position_start: 0,
    position_end: 0,
    position_middle: 0,
    lastPosition: 0,
    height_start: 0,
    height_end: 0,
    height_middle: 0,
    usedMode: '',
    usedProfile: '',
    color: '',
    textColor: '',
    text: '',
    isStriped: false,
    isIncompatible: false,
  };

  segment.position_start = modeAndProfile.start;
  segment.position_end = modeAndProfile.stop;
  segment.position_middle = (modeAndProfile.start + modeAndProfile.stop) / 2;
  segment.lastPosition = fullModesAndProfiles.slice(-1)[0].stop;
  segment.height_start = 4;
  segment.height_end = 24;
  segment.height_middle = (segment.height_start + segment.height_end) / 2;
  segment.usedMode = modeAndProfile.used_mode;
  segment.usedProfile = modeAndProfile.used_profile;

  // prepare colors
  const electricalProfileColorsWithProfile: Mode = {
    25000: { 25000: '#6E1E78', 22500: '#A453AD', 20000: '#DD87E5' },
    1500: {
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
    15000: '#009AA6',
    3000: '#1FBE00',
  };

  const electricalProfileColorsWithoutProfile: Mode = {
    25000: '#6E1E78',
    1500: '#FF0037',
    thermal: '#333',
    15000: '#009AA6',
    3000: '#1FBE00',
  };

  // add colors to object depending of the presence of used_profile
  segment.color =
    electricalProfileColorsWithProfile[segment.usedMode as keyof unknown][
      segment.usedProfile as string
    ] || electricalProfileColorsWithoutProfile[segment.usedMode as keyof unknown];

  segment.textColor = electricalProfileColorsWithoutProfile[segment.usedMode as keyof unknown];

  // adapt text depending of the mode and profile
  if (segment.usedMode === 'thermal') {
    segment.text = `${segment.usedMode}`;
  } else if (!segment.usedProfile) {
    segment.text = `${segment.usedMode}V`;
  } else if (segment.usedMode === '25000') {
    segment.text = `${segment.usedProfile}V`;
  } else {
    segment.text = `${segment.usedMode}V ${segment.usedProfile}`;
  }

  // figure out if the profile is incompatible or missing
  if (!segment.usedProfile && (segment.text === '25000V' || segment.text === '1500V')) {
    segment.isStriped = true;
  } else if (
    segment.usedProfile &&
    segment.usedMode === '1500' &&
    !segment.usedProfile.match(/O|A|B|C|D|E|F|G/)
  ) {
    segment.isIncompatible = true;
    segment.isStriped = true;
    segment.text = `${segment.usedMode}V`;
  } else if (
    segment.usedProfile &&
    segment.usedMode === '25000' &&
    !segment.usedProfile.match(/25000|22500|20000/)
  ) {
    segment.isIncompatible = true;
    segment.isStriped = true;
    segment.text = `${segment.usedMode}V`;
  }

  return segment;
};
