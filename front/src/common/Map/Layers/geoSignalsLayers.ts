import {
  ALL_SIGNAL_LAYERS,
  ALL_SIGNAL_LAYERS_SET,
  LIGHT_SIGNALS,
  PANELS_STOPS,
} from 'common/Map/Consts/SignalsNames';

import { SIGNALS_PANELS } from 'common/Map/const';
import { CircleLayer, SourceLayer, SymbolLayer, SymbolLayout, Theme } from '../../../types';

const signalTextOffsetX = 5;
const signalTextOffsetY = -1;
const signalCenteredTextOffset = [0, 6];

export interface SignalsSettings {
  all?: boolean;
  stops?: boolean;
  tivs?: boolean;
  lights?: boolean;
}

export interface SignalContext {
  prefix: string;
  sourceLayer: SourceLayer;
  sourceTable?: string;
  colors: Theme;
  signalsList: string[];
}

interface ChangeSignalContext {
  yellowSignalIds?: string[];
  greenSignalsIds?: string[];
  redSignalIds?: string[];
}

const defaultChangeSignalsIds = {
  yellowSignalIds: [],
  greenSignalsIds: [],
  redSignalIds: [],
};

export function getSignalsList(signalsSettings: SignalsSettings) {
  let signalsList: string[] = [];
  if (signalsSettings.all) {
    return ALL_SIGNAL_LAYERS;
  }
  if (signalsSettings.stops) {
    signalsList = signalsList.concat(PANELS_STOPS);
  }
  if (signalsSettings.lights) {
    signalsList = signalsList.concat(LIGHT_SIGNALS);
  }
  return signalsList;
}

export function getPointLayerProps({
  signalsList,
  sourceTable,
  colors,
}: SignalContext): Omit<CircleLayer, 'id'> {
  const props: Omit<CircleLayer, 'id'> = {
    type: 'circle',
    minzoom: 9,
    filter: ['in', 'extensions_sncf_installation_type', ...signalsList],
    paint: {
      'circle-color': colors.signal.point,
      'circle-radius': 3,
    },
  };

  if (typeof sourceTable === 'string') props['source-layer'] = sourceTable;

  return props;
}

export function signalsToSprites(
  { prefix }: SignalContext,
  type: string
): SymbolLayout['icon-image'] {
  switch (type) {
    case 'ARRET VOY':
      return ['concat', prefix, 'ARRET VOY ', ['get', 'extensions_sncf_label']];
    case 'CARRE':
    case 'S':
    case 'CARRE A':
    case 'S A':
    case 'CARRE VL':
    case 'S VL':
    case 'A':
    case 'CV':
      return ['concat', prefix, type];
    default:
      return ALL_SIGNAL_LAYERS_SET.has(type) ? `${prefix}${type}` : `${prefix}UNKNOWN`;
  }
}

export function getSignalMatLayerProps({
  signalsList,
  sourceTable,
}: SignalContext): Omit<SymbolLayer, 'id'> {
  const props: Omit<SymbolLayer, 'id'> = {
    type: 'symbol',
    minzoom: 12,
    filter: ['in', 'extensions_sncf_installation_type', ...signalsList],
    paint: {},
    layout: {
      'text-field': '', // '{extensions_sncf_installation_type} / {extensions_sncf_value} / {extensions_sncf_label}',
      'text-font': ['Roboto Condensed'],
      'text-size': 9,
      'icon-image': [
        'case',
        ['==', ['get', 'extensions_sncf_side'], 'RIGHT'],
        'MATD',
        ['==', ['get', 'extensions_sncf_side'], 'LEFT'],
        'MATG',
        '',
      ],
      'icon-size': 0.7,
      'icon-rotation-alignment': 'map',
      'icon-pitch-alignment': 'map',
      'icon-rotate': ['get', 'angle'],
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
      'text-allow-overlap': true,
      'text-ignore-placement': true,
    },
  };

  if (typeof sourceTable === 'string') props['source-layer'] = sourceTable;

  return props;
}

export function getSignalEmptyLayerProps(
  context: SignalContext,
  type: string,
  iconOffset: SymbolLayout['icon-offset'],
  libelle = 'extensions_sncf_value'
): Omit<SymbolLayer, 'id'> {
  const { sourceTable, colors } = context;
  const excludeText = ['SIGNAUX A GAUCHE', 'SIGNAUX A DROITE'];

  const props: Omit<SymbolLayer, 'id'> = {
    type: 'symbol',
    minzoom: 13,
    filter: ['==', 'extensions_sncf_installation_type', type],
    layout: {
      'text-field': [
        'case',
        ['in', ['get', libelle], ['literal', excludeText]],
        '',
        ['get', libelle],
      ],
      'text-font': ['SNCF'],
      'text-size': 8,
      'text-offset': [
        'case',
        ['==', ['get', 'extensions_sncf_side'], 'RIGHT'],
        ['literal', [1, -3]],
        ['==', ['get', 'extensions_sncf_side'], 'LEFT'],
        ['literal', [-1, -3]],
        ['literal', [0, 0]],
      ],
      'icon-offset': iconOffset,
      'icon-image': signalsToSprites(context, type),
      'icon-size': 0.5,
      'text-anchor': [
        'case',
        ['==', ['get', 'extensions_sncf_side'], 'RIGHT'],
        'left',
        ['==', ['get', 'extensions_sncf_side'], 'LEFT'],
        'right',
        'center',
      ],
      'icon-rotation-alignment': 'map',
      'icon-pitch-alignment': 'map',
      'text-rotation-alignment': 'map',
      'icon-rotate': ['get', 'angle'],
      'text-rotate': ['get', 'angle'],
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
      'text-allow-overlap': true,
    },
    paint: {
      'text-color': colors.signal.text,
      'text-halo-width': 10,
      'text-halo-color': colors.signal.halo,
      'text-halo-blur': 0,
    },
  };

  if (typeof sourceTable === 'string') props['source-layer'] = sourceTable;

  return props;
}

export function getSignalPNLayerProps(
  { sourceTable }: SignalContext,
  _type: string,
  iconOffset: SymbolLayout['icon-offset']
): Omit<SymbolLayer, 'id'> {
  const props: Omit<SymbolLayer, 'id'> = {
    type: 'symbol',
    minzoom: 13,
    filter: ['==', 'extensions_sncf_installation_type', 'PN'],
    layout: {
      'text-field': '{extensions_sncf_label}',
      'text-font': ['SNCF'],
      'text-size': 8,
      'text-offset': [
        'case',
        ['==', ['get', 'extensions_sncf_side'], 'RIGHT'],
        ['literal', [3.5, -3.5]],
        ['==', ['get', 'extensions_sncf_side'], 'LEFT'],
        ['literal', [-3.5, -3.5]],
        ['literal', [0, 0]],
      ],
      'icon-offset': iconOffset,
      'icon-image': 'VIDEN2',
      'icon-size': 0.5,
      'text-anchor': 'center',
      'icon-rotation-alignment': 'map',
      'icon-pitch-alignment': 'map',
      'text-rotation-alignment': 'map',
      'icon-rotate': ['get', 'angle'],
      'text-rotate': ['get', 'angle'],
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
      'text-allow-overlap': true,
    },
    paint: {
      'text-color': '#fff',
    },
  };

  if (typeof sourceTable === 'string') props['source-layer'] = sourceTable;

  return props;
}

export function getSignalALayerProps(
  context: SignalContext,
  _type: string,
  iconOffset: SymbolLayout['icon-offset'],
  changeSignalContext: ChangeSignalContext
): Omit<SymbolLayer, 'id'> {
  const { sourceTable, colors } = context;
  const { yellowSignalIds = [] } = changeSignalContext;
  const typeFilter = _type.split(' ')[0];
  const filterA = ['in', 'id'].concat(yellowSignalIds);
  const props: Omit<SymbolLayer, 'id'> = {
    type: 'symbol',
    minzoom: 12,
    filter: ['all', ['==', 'extensions_sncf_installation_type', typeFilter], filterA],
    layout: {
      'text-field': '{extensions_sncf_label}',
      'text-font': ['SNCF'],
      'text-size': 8,
      'text-offset': [
        'case',
        ['==', ['get', 'extensions_sncf_side'], 'RIGHT'],
        ['literal', [signalTextOffsetX, signalTextOffsetY]],
        ['==', ['get', 'extensions_sncf_side'], 'LEFT'],
        ['literal', [signalTextOffsetX * -1, signalTextOffsetY]],
        ['literal', signalCenteredTextOffset],
      ],
      'icon-offset': iconOffset,
      'icon-image': signalsToSprites(context, _type),
      'icon-size': 0.5,
      'text-anchor': 'center',
      'icon-rotation-alignment': 'map',
      'icon-pitch-alignment': 'map',
      'text-rotation-alignment': 'map',
      'icon-rotate': ['get', 'angle'],
      'text-rotate': ['get', 'angle'],
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
      'text-allow-overlap': true,
    },
    paint: {
      'text-color': colors.signal.text,
      'text-halo-width': 3,
      'text-halo-color': colors.signal.halo,
      'text-halo-blur': 0,
    },
  };

  if (typeof sourceTable === 'string') props['source-layer'] = sourceTable;

  return props;
}

export function getSignalVLLayerProps(
  context: SignalContext,
  _type: string,
  iconOffset: SymbolLayout['icon-offset'],
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _changeSignalContext: ChangeSignalContext
): Omit<SymbolLayer, 'id'> {
  const { sourceTable, colors } = context;
  const typeFilter = _type.split(' ')[0];
  const props: Omit<SymbolLayer, 'id'> = {
    type: 'symbol',
    minzoom: 12,
    filter: ['==', 'extensions_sncf_installation_type', typeFilter],
    layout: {
      'text-field': '{extensions_sncf_label}',
      'text-font': ['SNCF'],
      'text-size': 7,
      'text-offset': [
        'case',
        ['==', ['get', 'extensions_sncf_side'], 'RIGHT'],
        ['literal', [signalTextOffsetX, signalTextOffsetY]],
        ['==', ['get', 'extensions_sncf_side'], 'LEFT'],
        ['literal', [signalTextOffsetX * -1, signalTextOffsetY]],
        ['literal', signalCenteredTextOffset],
      ],
      'icon-offset': iconOffset,
      'icon-image': signalsToSprites(context, _type),
      'icon-size': 0.5,
      'text-anchor': 'center',
      'icon-rotation-alignment': 'map',
      'icon-pitch-alignment': 'map',
      'text-rotation-alignment': 'map',
      'icon-rotate': ['get', 'angle'],
      'text-rotate': ['get', 'angle'],
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
      'text-allow-overlap': true,
    },
    paint: {
      'text-color': colors.signal.text,
      'text-halo-width': 3,
      'text-halo-color': colors.signal.halo,
      'text-halo-blur': 0,
    },
  };

  if (typeof sourceTable === 'string') props['source-layer'] = sourceTable;

  return props;
}

export function getSignalStopLayerProps(
  context: SignalContext,
  _type: string,
  iconOffset: SymbolLayout['icon-offset'],
  changeSignalContext: ChangeSignalContext
): Omit<SymbolLayer, 'id'> {
  const { sourceTable, colors } = context;
  const { redSignalIds = [] } = changeSignalContext;
  const typeFilter = _type.split(' ')[0];
  const filterA = ['in', 'id'].concat(redSignalIds);

  const props: Omit<SymbolLayer, 'id'> = {
    type: 'symbol',
    minzoom: 12,
    filter: ['all', ['==', 'extensions_sncf_installation_type', typeFilter], filterA],
    layout: {
      'text-field': '{extensions_sncf_label}',
      'text-font': ['SNCF'],
      'text-size': 8,
      'text-offset': [
        'case',
        ['==', ['get', 'extensions_sncf_side'], 'RIGHT'],
        ['literal', [signalTextOffsetX, signalTextOffsetY]],
        ['==', ['get', 'extensions_sncf_side'], 'LEFT'],
        ['literal', [signalTextOffsetX * -1, signalTextOffsetY]],
        ['literal', signalCenteredTextOffset],
      ],
      'icon-offset': iconOffset,
      'icon-image': signalsToSprites(context, _type),
      'icon-size': 0.5,
      'text-anchor': 'center',
      'icon-rotation-alignment': 'map',
      'icon-pitch-alignment': 'map',
      'text-rotation-alignment': 'map',
      'icon-rotate': ['get', 'angle'],
      'text-rotate': ['get', 'angle'],
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
      'text-allow-overlap': true,
    },
    paint: {
      'text-color': colors.signal.text,
      'text-halo-width': 3,
      'text-halo-color': colors.signal.halo,
      'text-halo-blur': 0,
    },
  };

  if (typeof sourceTable === 'string') props['source-layer'] = sourceTable;

  return props;
}

export function getSignalLayerProps(
  context: SignalContext,
  type: string,
  changeSignalContext: ChangeSignalContext = defaultChangeSignalsIds
): Omit<SymbolLayer, 'id'> {
  const { sourceTable, sourceLayer, prefix, colors } = context;
  const angleName = sourceLayer === 'sch' ? 'angle_sch' : 'angle_geo';
  let size = 0.4;
  let offsetY = -105;
  let iconOffsetX = 45;
  let textOffsetX = 30;
  const textOffsetY = 5;
  let isSignal = true;
  if (SIGNALS_PANELS.indexOf(type) !== -1 && SIGNALS_PANELS.indexOf(type) === -1) {
    size = 0.4;
    iconOffsetX = 55;
    textOffsetX = 3;
    offsetY = -60;
    isSignal = false;
  } else if (prefix !== '') {
    size = 0.8;
    iconOffsetX = 30;
    offsetY = -80;
  }
  /*
  if (SIGNALS_PANELS.indexOf(type) !== -1) {
    offsetY = -105;
  }
  */

  const minZoom = 14;

  const textOffset: SymbolLayout['text-offset'] = [
    'case',
    ['==', ['get', 'extensions_sncf_side'], 'RIGHT'],
    ['literal', [textOffsetX, textOffsetY]],
    ['==', ['get', 'extensions_sncf_side'], 'LEFT'],
    ['literal', [textOffsetX * -1, textOffsetY]],
    ['literal', [2, 0]],
  ];

  const iconOffset: SymbolLayout['icon-offset'] = [
    'case',
    ['==', ['get', 'extensions_sncf_side'], 'RIGHT'],
    ['literal', [iconOffsetX, offsetY]],
    ['==', ['get', 'extensions_sncf_side'], 'LEFT'],
    ['literal', [iconOffsetX * -1, offsetY]],
    ['literal', [0, 0]],
  ];

  switch (type) {
    case 'REPER VIT':
      return getSignalEmptyLayerProps(context, type, iconOffset, 'extensions_sncf_label');
    case 'DESTI':
    case 'DIVERS':
      return getSignalEmptyLayerProps(context, type, iconOffset);
    case 'PN':
      return getSignalPNLayerProps(context, type, iconOffset);
    case 'CARRE A':
    case 'S A':
      return getSignalALayerProps(context, type, iconOffset, changeSignalContext);
    case 'CARRE VL':
    case 'S VL':
      return getSignalVLLayerProps(context, type, iconOffset, changeSignalContext);
    case 'CARRE':
    case 'S':
      return getSignalStopLayerProps(context, type, iconOffset, changeSignalContext);
    case 'A':
    case 'CV':
    case 'D':
    case 'ID':
      return getSignalVLLayerProps(context, type, iconOffset, changeSignalContext);
    default:
      break;
  }

  const props: Omit<SymbolLayer, 'id'> = {
    minzoom: 12,
    type: 'symbol',
    filter: ['==', 'extensions_sncf_installation_type', type],
    layout: {
      'text-field': [
        'step',
        ['zoom'],
        '',
        minZoom,
        ['case', isSignal, ['get', 'extensions_sncf_label'], ''],
      ],
      'text-font': ['Roboto Condensed'],
      'text-size': 9,
      'text-offset': textOffset,
      'icon-offset': ['step', ['zoom'], ['literal', [0, 0]], minZoom, iconOffset],
      'icon-image': signalsToSprites(context, type),
      'icon-size': ['step', ['zoom'], size / 2, minZoom, size],
      'text-anchor': [
        'case',
        ['==', ['get', 'extensions_sncf_side'], 'RIGHT'],
        'left',
        ['==', ['get', 'extensions_sncf_side'], 'LEFT'],
        'right',
        'center',
      ],
      'icon-anchor': 'center',
      'icon-rotation-alignment': 'map',
      'icon-pitch-alignment': 'map',
      'text-rotation-alignment': 'map',
      'icon-rotate': ['get', angleName],
      'text-rotate': ['get', angleName],
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
      'text-allow-overlap': true,
    },
    paint: {
      'text-color': colors.signal.text,
      'text-halo-width': 3,
      'text-halo-color': colors.signal.halo,
      'text-halo-blur': 0,
    },
  };

  if (typeof sourceTable === 'string') props['source-layer'] = sourceTable;

  return props;
}
