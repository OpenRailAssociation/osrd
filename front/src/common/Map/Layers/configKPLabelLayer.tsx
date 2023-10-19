import { ExpressionFilterSpecification } from 'maplibre-gl';
import { LayerProps } from 'react-map-gl/maplibre';

import { Theme } from 'types';

interface PlatformProps {
  colors: Theme;
  fieldName?: string;
  maxzoom?: number;
  minzoom?: number;
  isSignalisation?: boolean;
  sourceLayer: string;
}

export default function configKPLabelLayer(props: PlatformProps) {
  const {
    colors,
    fieldName = 'kp',
    maxzoom = 24,
    minzoom = 7,
    isSignalisation,
    sourceLayer,
  } = props;

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
          ['literal', [0, 2.5]],
        ],
      }
    : {
        'text-offset': ['literal', [-1, 0.1]],
      };

  const kpValue: LayerProps = {
    type: 'symbol',
    'source-layer': sourceLayer,
    filter: ['all', ['!=', ['literal', null], ['get', fieldName]], ['!=', '', ['get', fieldName]]],
    maxzoom,
    minzoom,
    layout: {
      'text-field': ['concat', 'PK ', ['get', fieldName]],
      'text-font': ['Roboto Medium'],
      'text-size': 9,
      'text-anchor': 'right',
      'text-allow-overlap': true,
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

  return kpValue;
}
