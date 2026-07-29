import chroma from 'chroma-js';

import {
  type ColorDictionary,
  type EtcsAlphaDictionary,
  EtcsBrakingCurveType,
  EtcsBrakingType,
  type EtcsColorDictionary,
  type EtcsLayersDisplay,
  type Store,
} from '../types';
import { BLUE_700, CYAN_400, LIME_50, NEUTRAL_300, STONE_100, STONE_50, YELLOW_400 } from '../../common/helpers/colors';

export const SLOPE_FILL_COLOR = NEUTRAL_300;

export const RIGHT_TICK_HEIGHT_OFFSET = 2;

export const TICK_TITLE_MARGINS = {
  Y_LEFT_VERTICAL: 30,
  Y_LEFT_HORIZONTAL: 22,
  Y_RIGHT_VERTICAL: 36,
  Y_RIGHT_HORIZONTAL: 42,
};

export const MARGINS = {
  MARGIN_LEFT: 48,
  MARGIN_RIGHT: 12,
  MARGIN_TOP: 27,
  MARGIN_BOTTOM: 52.5,
  CURVE_MARGIN_TOP: 40,
  CURVE_MARGIN_SIDES: 16,
  ELECTRICAL_PROFILES_MARGIN_TOP: 8,
  RIGHT_TICK_MARGINS: 60,
  OFFSET_RIGHT_AXIS: 42,
};

export const CURSOR_SNAP_DISTANCE = 6;

export const LINEAR_LAYERS_HEIGHTS = {
  ELECTRICAL_PROFILES_HEIGHT: 56,
  POWER_RESTRICTIONS_HEIGHT: 40,
  SPEED_LIMIT_TAGS_HEIGHT: 40,
};

export const LINEAR_LAYER_SEPARATOR_HEIGHT = 1;

export const LINEAR_LAYERS_BACKGROUND_COLOR = {
  FIRST: STONE_50,
  SECOND: STONE_100,
  THIRD: LIME_50,
};

export const FRONT_INTERACTIVITY_LAYER_ID = '#front-interactivity-layer';

export const DETAILS_BOX_SELECTION: Array<keyof Store['detailsBoxDisplay']> = [
  'energySource',
  'tractionStatus',
  'declivities',
  'etcs',
  'electricalProfiles',
  'powerRestrictions',
];

export const LAYERS_SELECTION: Array<keyof Store['layersDisplay']> = [
  'steps',
  'declivities',
  'speedLimits',
  'electricalProfiles',
  'powerRestrictions',
  'speedLimitTags',
];

export const DEFAULT_ETCS_LAYERS_DISPLAY = {
  etcsBrakingTypes: {
    stopsAndTransitions: false,
    spacing: false,
    routing: false,
  },
  etcsBrakingCurveTypes: {
    indication: true,
    permittedSpeed: true,
    guidance: true,
  },
};

export const ETCS_BRAKING_SELECTION: Record<
  keyof EtcsLayersDisplay['etcsBrakingTypes'],
  EtcsBrakingType[]
> = {
  stopsAndTransitions: [EtcsBrakingType.SLOWDOWN, EtcsBrakingType.STOP],
  spacing: [EtcsBrakingType.SPACING],
  routing: [EtcsBrakingType.ROUTING],
};

export const ETCS_CURVE_SELECTION: Record<
  keyof EtcsLayersDisplay['etcsBrakingCurveTypes'],
  EtcsBrakingCurveType
> = {
  indication: EtcsBrakingCurveType.IND,
  permittedSpeed: EtcsBrakingCurveType.PS,
  guidance: EtcsBrakingCurveType.GUI,
};

// Etcs color dictionary
export const ETCS_COLOR_DICTIONARY: EtcsColorDictionary = {
  [EtcsBrakingCurveType.IND]: chroma(CYAN_400),
  [EtcsBrakingCurveType.PS]: chroma(BLUE_700),
  [EtcsBrakingCurveType.GUI]: chroma(YELLOW_400),
};

// Etcs color transparency dictionary
export const ETCS_ALPHA_DICTIONARY: EtcsAlphaDictionary = {
  [EtcsBrakingCurveType.IND]: 0.3,
  [EtcsBrakingCurveType.PS]: 0.24,
  [EtcsBrakingCurveType.GUI]: 0.4,
};

/**
 * COLOR_DICTIONARY maps specific colors to their corresponding secondary colors used for speed limit tags.
 */
export const COLOR_DICTIONARY: ColorDictionary = {
  '#216482': '#E5F7FF',
  '#D91C1C': '#F15981',
  '#494641': '#F2F0E4',
  '#EAA72B': '#EAA72B',
  '#94918E': '#94918E',
};

export const ZOOM_CONFIG = {
  MIN_RATIO: 1,
  MAX_RATIO: 50,
  SLIDER_WIDTH: 100,
};

export const SPEEDS_LINEWIDTH = 0.5;
export const ETCS_LINEWIDTH = 3;
