import { AMBIENT_B_10, AMBIENT_B_15, AMBIENT_B_5 } from '../../common/helpers/colors';
import {
  type ColorDictionary,
  EtcsBrakingCurveType,
  EtcsBrakingType,
  type EtcsColorDictionary,
  type EtcsLayersDisplay,
  type Store,
} from '../types';

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

export const LINEAR_LAYERS_DEFAULT_BACKGROUND_COLOR = AMBIENT_B_5;
export const LINEAR_LAYERS_SINGLE_BACKGROUND_COLOR = AMBIENT_B_10;
export const LINEAR_LAYERS_BOTH_BACKGROUND_COLOR = AMBIENT_B_15;

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

// Colors

export const BASE_SPEED_FILL_COLOR = 'rgb(17 101 180 / 0.15)';
export const BASE_SPEED_STROKE_COLOR = 'rgb(17, 101, 180)';

export const ECO_SPEED_STROKE_COLOR = 'rgb(7, 69, 128)';

export const SLOPE_FILL_COLOR = 'rgb(207, 221, 206)';

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
export const IND_STROKE_COLOR = 'rgb(3 222 255 / 0.3)';
export const PS_STROKE_COLOR = 'rgb(0 87 218 / 0.24)';
export const GUI_STROKE_COLOR = 'rgb(255 192 3 / 0.4)';

// Etcs color dictionary
export const ETCS_COLOR_DICTIONARY: EtcsColorDictionary = {
  [EtcsBrakingCurveType.IND]: IND_STROKE_COLOR,
  [EtcsBrakingCurveType.PS]: PS_STROKE_COLOR,
  [EtcsBrakingCurveType.GUI]: GUI_STROKE_COLOR,
};
