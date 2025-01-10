import type { CircleLayer, SymbolLayer } from 'react-map-gl/maplibre';

import type { SignalContext } from 'common/Map/Layers/types';
import holyLand from 'common/MotriceRelated/holyLand';
import type { OmitLayer } from 'types';

const signalTextOffsetX = 5;
const signalTextOffsetY = -1;
const signalCenteredTextOffset = [0, 6];

export function getPointLayerProps({ sourceTable, colors }: SignalContext): OmitLayer<CircleLayer> {
  const props: OmitLayer<CircleLayer> = {
    type: 'circle',
    minzoom: 9,
    paint: {
      'circle-color': colors.signal.point,
      'circle-radius': 3,
    },
  };

  if (typeof sourceTable === 'string') props['source-layer'] = sourceTable;

  return props;
}

export function getSignalLayerProps(context: SignalContext): OmitLayer<SymbolLayer> {
  const { sourceTable, colors } = context;
  const offsetY = -105;
  const iconOffsetX = 45;

  const iconOffset: Required<SymbolLayer>['layout']['icon-offset'] = [
    'case',
    ['==', ['get', 'extensions_sncf_side'], 'RIGHT'],
    ['literal', [iconOffsetX, offsetY]],
    ['==', ['get', 'extensions_sncf_side'], 'LEFT'],
    ['literal', [iconOffsetX * -1, offsetY]],
    ['literal', [0, 0]],
  ];

  const props: OmitLayer<SymbolLayer> = {
    type: 'symbol',
    minzoom: 12,
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
      'icon-image': [
        'case',
        ['within', holyLand],
        'UNKNOWN2',
        ['==', ['get', 'signaling_system'], ['literal', null]],
        'UNKNOWN',
        ['concat', ['get', 'signaling_system'], ':', ['get', 'sprite']],
      ],
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
