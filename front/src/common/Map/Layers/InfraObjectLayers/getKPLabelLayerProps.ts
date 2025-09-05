import type { Geometry } from 'geojson';
import type { ExpressionFilterSpecification } from 'maplibre-gl';
import type { SymbolLayerSpecification } from 'react-map-gl/maplibre';

import { getAllowOverlap, getDynamicTextSize } from 'common/Map/Layers/commonLayers';
import type { Theme } from 'common/Map/theme';
import type { OmitLayer } from 'types';

import type { LayerProps } from '../types';

export default function getKPLabelLayerProps(params: {
  sourceTable?: string;
  isSignalisation?: boolean;
  bottomOffset?: number;
  PKFieldName?: string;
  colors: Theme;
  minzoom?: number;
  highlightedArea?: Geometry;
}): OmitLayer<SymbolLayerSpecification> {
  const {
    bottomOffset = 2.5,
    colors,
    PKFieldName = 'kp',
    minzoom = 7,
    isSignalisation = false,
    sourceTable,
    highlightedArea,
  } = params;

  // Will have to be removed when backend will be updated with consistent fieldnames
  const testSideExpression = (side: 'LEFT' | 'RIGHT' | 'CENTER') => [
    'any',
    ['==', ['get', 'extensions_sncf_side'], side],
    ['==', ['get', 'side'], side],
  ];

  const signallingLabeling: LayerProps['layout'] = isSignalisation
    ? {
        'text-rotation-alignment': 'map',
        'text-pitch-alignment': 'map',
        'text-rotate': ['get', 'angle'],
        'text-anchor': [
          'case',
          testSideExpression('LEFT') as ExpressionFilterSpecification,
          'right',
          testSideExpression('RIGHT') as ExpressionFilterSpecification,
          'left',
          'center',
        ],
        'text-offset': [
          'case',
          testSideExpression('LEFT') as ExpressionFilterSpecification,
          ['literal', [-2.75, 0.2]],
          testSideExpression('RIGHT') as ExpressionFilterSpecification,
          ['literal', [2.75, 0.2]],
          ['literal', [0, bottomOffset]],
        ],
      }
    : {
        'text-offset': ['literal', [-1, 0.1]],
      };

  const res: OmitLayer<SymbolLayerSpecification> = {
    type: 'symbol',
    filter: [
      'all',
      ['!=', ['literal', null], ['get', PKFieldName]],
      ['!=', '', ['get', PKFieldName]],
      highlightedArea ? ['within', highlightedArea] : true,
    ],
    minzoom,
    layout: {
      'text-field': ['get', PKFieldName],
      'text-font': ['IBMPlexSans'],
      'text-size': getDynamicTextSize({ fromSize: 9, toSize: 15 }),
      'text-anchor': 'right',
      'text-allow-overlap': getAllowOverlap(),
      'text-ignore-placement': false,

      ...signallingLabeling,
    },
    paint: {
      'text-color': colors.kp.text,
    },
  };

  if (typeof sourceTable === 'string') res['source-layer'] = sourceTable;

  return res;
}
