import { SymbolLayout } from 'mapbox-gl';
import { LayerProps } from 'react-map-gl';

import {
  ALL_SIGNAL_LAYERS,
  ALL_SIGNAL_LAYERS_SET,
  LIGHT_SIGNALS,
  PANELS_STOPS,
  PANELS_TIVS,
} from 'common/Map/Consts/SignalsNames';
import { SIGNALS_PANELS } from 'common/Map/const';
import { SourceLayer, Theme } from '../../../types';

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

export function getSignalsList(signalsSettings: SignalsSettings) {
  let signalsList: string[] = [];
  if (signalsSettings.all) {
    return ALL_SIGNAL_LAYERS;
  }
  if (signalsSettings.stops) {
    signalsList = signalsList.concat(PANELS_STOPS);
  }
  if (signalsSettings.tivs) {
    signalsList = signalsList.concat(PANELS_TIVS);
  }
  if (signalsSettings.lights) {
    signalsList = signalsList.concat(LIGHT_SIGNALS);
  }
  return signalsList;
}

export function getAngleName(sourceLayer: SourceLayer) {
  return sourceLayer === 'sch' ? 'angle_sch' : 'angle_geo';
}

export function getPointLayerProps({
  signalsList,
  sourceTable,
  colors,
}: SignalContext): LayerProps {
  const props: LayerProps = {
    type: 'circle',
    minzoom: 9,
    filter: ['in', ['get', 'installation_type'], ['literal', signalsList]],
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
    case 'TIV D FIXE':
      return ['concat', prefix, 'TIV D FIXE ', ['get', 'value']];
    case 'TIV D MOB':
      return ['concat', prefix, 'TIV D MOB ', ['get', 'value']];
    case 'TIV R MOB':
      return ['concat', prefix, 'TIV R MOB ', ['get', 'value']];
    case 'TIVD C FIX':
      return ['concat', prefix, 'TIVD C FIX ', ['get', 'value']];
    case 'TIVD B FIX':
      return ['concat', prefix, 'TIVD B FIX ', ['get', 'value']];
    case 'TIV PENDIS':
      return ['concat', prefix, 'TIV PENDIS ', ['get', 'value']];
    case 'TIV PENEXE':
      return ['concat', prefix, 'TIV PENEXE ', ['get', 'value']];
    case 'CHEVRON':
      return `${prefix}CHEVRON BAS`;
    case 'ARRET VOY':
      return ['concat', prefix, 'ARRET VOY ', ['get', 'label']];
    case 'DIVERS':
      return [
        'case',
        ['==', ['get', 'value'], `${prefix}SIGNAUX A GAUCHE`],
        `${prefix}SIG A GAUCHE`,
        ['==', ['get', 'value'], `${prefix}SIGNAUX A DROITE`],
        `${prefix}SIG A DROITE`,
        '',
      ];
    case 'TECS':
    case 'TSCS':
      return [
        'concat',
        prefix,
        type,
        ' ',
        ['case', ['==', ['get', 'side'], 'RIGHT'], 'D', ['==', ['get', 'side'], 'LEFT'], 'G', ''],
      ];
    default:
      return ALL_SIGNAL_LAYERS_SET.has(type) ? `${prefix}${type}` : `${prefix}UNKNOWN`;
  }
}

export function getSignalMatLayerProps({
  signalsList,
  sourceLayer,
  sourceTable,
}: SignalContext): LayerProps {
  const angleName = sourceLayer === 'sch' ? 'angle_sch' : 'angle_geo';

  const props: LayerProps = {
    type: 'symbol',
    minzoom: 14,
    filter: ['in', ['get', 'installation_type'], ['literal', signalsList]],
    paint: {},
    layout: {
      'text-field': '', // '{installation_type} / {value} / {label}',
      'text-font': ['Roboto Condensed'],
      'text-size': 9,
      'icon-image': [
        'case',
        ['==', ['get', 'side'], 'RIGHT'],
        'MATD',
        ['==', ['get', 'side'], 'LEFT'],
        'MATG',
        '',
      ],
      'icon-size': 0.7,
      'icon-rotation-alignment': 'map',
      'icon-pitch-alignment': 'map',
      'icon-rotate': ['get', angleName],
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
  libelle = 'value'
): LayerProps {
  const { sourceLayer, sourceTable, colors } = context;
  const angleName = getAngleName(sourceLayer);
  const excludeText = ['SIGNAUX A GAUCHE', 'SIGNAUX A DROITE'];

  const props: LayerProps = {
    type: 'symbol',
    minzoom: 13,
    filter: ['==', 'installation_type', type],
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
        ['==', ['get', 'side'], 'RIGHT'],
        ['literal', [1, -3]],
        ['==', ['get', 'side'], 'LEFT'],
        ['literal', [-1, -3]],
        ['literal', [0, 0]],
      ],
      'icon-offset': iconOffset,
      'icon-image': signalsToSprites(context, type),
      'icon-size': 0.5,
      'text-anchor': [
        'case',
        ['==', ['get', 'side'], 'RIGHT'],
        'left',
        ['==', ['get', 'side'], 'LEFT'],
        'right',
        'center',
      ],
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
      'text-halo-width': 10,
      'text-halo-color': colors.signal.halo,
      'text-halo-blur': 0,
    },
  };

  if (typeof sourceTable === 'string') props['source-layer'] = sourceTable;

  return props;
}

export function getSignalPNLayerProps(
  { sourceTable, sourceLayer }: SignalContext,
  _type: string,
  iconOffset: SymbolLayout['icon-offset']
): LayerProps {
  const angleName = getAngleName(sourceLayer);

  const props: LayerProps = {
    type: 'symbol',
    minzoom: 13,
    filter: ['==', 'installation_type', 'PN'],
    layout: {
      'text-field': '{label}',
      'text-font': ['SNCF'],
      'text-size': 8,
      'text-offset': [
        'case',
        ['==', ['get', 'side'], 'RIGHT'],
        ['literal', [3.5, -3.5]],
        ['==', ['get', 'side'], 'LEFT'],
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
      'icon-rotate': ['get', angleName],
      'text-rotate': ['get', angleName],
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

export function getSignalLayerProps(context: SignalContext, type: string): LayerProps {
  const { sourceTable, sourceLayer, prefix, colors } = context;
  const angleName = sourceLayer === 'sch' ? 'angle_sch' : 'angle_geo';

  let size = 0.4;
  let offsetY = -105;
  let iconOffsetX = 55;
  let textOffsetX = 3;
  let isSignal = true;
  if (SIGNALS_PANELS.indexOf(type) !== -1) {
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

  const minZoom = 14;

  const textOffset: SymbolLayout['text-offset'] = [
    'case',
    ['==', ['get', 'side'], 'RIGHT'],
    ['literal', [textOffsetX, -0.3]],
    ['==', ['get', 'side'], 'LEFT'],
    ['literal', [textOffsetX * -1, -0.3]],
    ['literal', [2, 0]],
  ];

  const iconOffset: SymbolLayout['icon-offset'] = [
    'case',
    ['==', ['get', 'side'], 'RIGHT'],
    ['literal', [iconOffsetX, offsetY]],
    ['==', ['get', 'side'], 'LEFT'],
    ['literal', [iconOffsetX * -1, offsetY]],
    ['literal', [0, 0]],
  ];

  switch (type) {
    case 'REPER VIT':
      return getSignalEmptyLayerProps(context, type, iconOffset, 'label');
    case 'DESTI':
    case 'DIVERS':
      return getSignalEmptyLayerProps(context, type, iconOffset);
    case 'PN':
      return getSignalPNLayerProps(context, type, iconOffset);
    default:
  }

  const props: LayerProps = {
    minzoom: 12,
    type: 'symbol',
    filter: ['==', 'installation_type', type],
    layout: {
      'text-field': ['step', ['zoom'], '', minZoom, ['case', isSignal, ['get', 'label'], '']],
      'text-font': ['Roboto Condensed'],
      'text-size': 9,
      'text-offset': textOffset,
      'icon-offset': ['step', ['zoom'], ['literal', [0, 0]], minZoom, iconOffset],
      'icon-image': signalsToSprites(context, type),
      'icon-size': ['step', ['zoom'], size / 2, minZoom, size],
      'text-anchor': [
        'case',
        ['==', ['get', 'side'], 'RIGHT'],
        'left',
        ['==', ['get', 'side'], 'LEFT'],
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
