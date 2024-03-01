import { isNil } from 'lodash';
import type { SymbolLayer } from 'react-map-gl/maplibre';

import type { OmitLayer } from 'types';

import type { LayerContext } from './types';

export default function getMastLayerProps({
  sourceTable,
  sidePropertyName = 'side',
  minzoom = 13,
}: Pick<LayerContext, 'sourceTable' | 'sidePropertyName' | 'minzoom'>): Omit<
  SymbolLayer,
  'source' | 'id'
> {
  const res: OmitLayer<SymbolLayer> = {
    type: 'symbol',
    minzoom,
    paint: {},
    layout: {
      'icon-image': [
        'case',
        ['==', ['get', sidePropertyName], 'RIGHT'],
        'MATD',
        ['==', ['get', sidePropertyName], 'LEFT'],
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

  if (!isNil(sourceTable)) {
    res['source-layer'] = sourceTable;
  }

  return res;
}
