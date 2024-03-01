import type { ExpressionFilterSpecification } from 'maplibre-gl';
import type { LayerProps, SymbolLayer } from 'react-map-gl/maplibre';

import type { OmitLayer, Theme } from 'types';

export default function getKPLabelLayerProps(params: {
  sourceTable?: string;
  isSignalisation?: boolean;
  bottomOffset?: number;
  PKFieldName?: string;
  colors: Theme;
  minzoom?: number;
}): OmitLayer<SymbolLayer> {
  const {
    bottomOffset = 2.5,
    colors,
    PKFieldName = 'kp',
    minzoom = 7,
    isSignalisation = false,
    sourceTable,
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

  const res: OmitLayer<SymbolLayer> = {
    type: 'symbol',
    filter: [
      'all',
      ['!=', ['literal', null], ['get', PKFieldName]],
      ['!=', '', ['get', PKFieldName]],
    ],
    minzoom,
    layout: {
      'text-field': ['get', PKFieldName],
      'text-font': ['Roboto Medium'],
      'text-size': 9,
      'text-anchor': 'right',
      'text-allow-overlap': isSignalisation, // allow signal's kp to be displayed, they are very closed
      'text-ignore-placement': false,

      ...signallingLabeling,
    },
    paint: {
      'text-color': colors.kp.text,
      'text-halo-width': 0,
      'text-halo-color': colors.kp.halo,
      'text-halo-blur': 1,
    },
  };

  if (typeof sourceTable === 'string') res['source-layer'] = sourceTable;

  return res;
}
