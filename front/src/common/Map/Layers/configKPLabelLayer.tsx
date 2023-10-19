import { LayerProps } from 'react-map-gl/maplibre';

import { Theme } from 'types';

interface PlatformProps {
  colors: Theme;
  fieldName?: string;
  leftOffset?: number;
  maxzoom?: number;
  minzoom?: number;
  rotation?: 'map' | 'viewport' | 'auto';
  sourceLayer: string;
}

/*
* signals
OK detectors: seulement ceux sous un signal, ceux qu'on genere en sur les tiv de jonction connait pas leur pk
OK buffer stops
OK les panneaux des psl
OK les operational point parts
*/

export default function configKPLabelLayer(props: PlatformProps) {
  const {
    colors,
    fieldName = 'kp',
    leftOffset = -1,
    maxzoom = 24,
    minzoom = 7,
    rotation = 'viewport',
    sourceLayer,
  } = props;
  const rkValue: LayerProps = {
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
      'text-ignore-placement': true,
      'text-offset': [leftOffset, 0.1],
      'text-rotation-alignment': rotation,
      'text-pitch-alignment': rotation,
      'text-rotate': rotation === 'map' ? ['get', 'angle_geo'] : 0,
    },
    paint: {
      'text-color': colors.kp.text,
      'text-halo-width': 0,
      'text-halo-color': colors.kp.halo,
      'text-halo-blur': 1,
    },
  };

  return rkValue;
}
