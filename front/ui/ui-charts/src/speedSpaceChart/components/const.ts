import chroma from 'chroma-js';

import {
  type ColorDictionary,
  EtcsBrakingCurveType,
  EtcsBrakingType,
  type EtcsColorDictionary,
  type EtcsLayersDisplay,
  type Store,
} from '../types';

export const SLOPE_FILL_COLOR = '#CFDDCE';

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
  FIRST: 'rgb(250, 249, 245)',
  SECOND: 'rgb(247, 246, 238)',
  THIRD: 'rgb(242, 240, 228)',
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
  stopsAndTransitions: [EtcsBrakingType.STOP, EtcsBrakingType.SLOWDOWN],
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

export const BLACK = chroma(0, 0, 0);
export const ERROR_30 = chroma(255, 104, 104);
export const ERROR_60 = chroma(217, 28, 28);
export const GREY_50 = chroma(121, 118, 113);
export const GREY_80 = chroma(49, 46, 43);
export const LIGHT_BLUE = chroma(33, 112, 185);
export const WARNING_30 = chroma(234, 167, 43);
export const WHITE = chroma(255, 255, 255);
export const BASE_SPEED_COLOR = chroma(17, 101, 180);
export const ECO_SPEED_COLOR = chroma(7, 69, 128);
const IND_COLOR = chroma(3, 222, 255);
const PS_COLOR = chroma(0, 87, 218);
const GUI_COLOR = chroma(255, 192, 3);
const IND_ALPHA = 0.3;
const PS_ALPHA = 0.24;
const GUI_ALPHA = 0.4;
export const BASE_SPEED_FILL_ALPHA = 0.15;

// Etcs color dictionary
export const ETCS_COLOR_DICTIONARY: EtcsColorDictionary = {
  [EtcsBrakingCurveType.IND]: IND_COLOR.alpha(IND_ALPHA),
  [EtcsBrakingCurveType.PS]: PS_COLOR.alpha(PS_ALPHA),
  [EtcsBrakingCurveType.GUI]: GUI_COLOR.alpha(GUI_ALPHA),
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
