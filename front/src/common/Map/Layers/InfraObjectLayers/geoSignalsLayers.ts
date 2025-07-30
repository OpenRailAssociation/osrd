import type { Geometry } from 'geojson';
import type { CircleLayerSpecification, SymbolLayerSpecification } from 'react-map-gl/maplibre';

import { DEFAULT_HALO_WIDTH, getDynamicTextSize } from 'common/Map/Layers/commonLayers';
import type { OmitLayer } from 'types';

import type { SignalContext } from '../types';

const signalTextOffsetX = 5;
const signalTextOffsetY = -1;
const signalCenteredTextOffset = [0, 6];

export function getPointLayerProps({
  sourceTable,
  colors,
  highlightedArea,
}: SignalContext & { highlightedArea?: Geometry }): OmitLayer<CircleLayerSpecification> {
  const props: OmitLayer<CircleLayerSpecification> = {
    type: 'circle',
    minzoom: 9,
    filter: highlightedArea ? ['within', highlightedArea] : true,
    paint: {
      'circle-color': colors.signal.point,
      'circle-radius': 3,
    },
  };

  if (typeof sourceTable === 'string') props['source-layer'] = sourceTable;

  return props;
}

export function getSignalLayerProps(
  context: SignalContext & { highlightedArea?: Geometry }
): OmitLayer<SymbolLayerSpecification> {
  const { sourceTable, colors, highlightedArea } = context;
  const offsetY = -105;
  const iconOffsetX = 45;

  const iconOffset: Required<SymbolLayerSpecification>['layout']['icon-offset'] = [
    'case',
    ['==', ['get', 'extensions_sncf_side'], 'RIGHT'],
    ['literal', [iconOffsetX, offsetY]],
    ['==', ['get', 'extensions_sncf_side'], 'LEFT'],
    ['literal', [iconOffsetX * -1, offsetY]],
    ['literal', [0, 0]],
  ];

  const props: OmitLayer<SymbolLayerSpecification> = {
    type: 'symbol',
    minzoom: 12,
    layout: {
      'text-field': '{extensions_sncf_label}',
      'text-font': ['SNCF'],
      'text-size': getDynamicTextSize({ fromSize: 8, toSize: 14 }),
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
    filter: highlightedArea ? ['within', highlightedArea] : true,
    paint: {
      'text-color': colors.signal.text,
      'text-halo-width': DEFAULT_HALO_WIDTH,
      'text-halo-color': colors.signal.halo,
    },
  };

  if (typeof sourceTable === 'string') props['source-layer'] = sourceTable;

  return props;
}
