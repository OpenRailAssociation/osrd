import { LayerProps } from 'react-map-gl/maplibre';

import { Theme } from 'types';

interface PlatformProps {
  colors: Theme;
  maxzoom?: number;
  minzoom?: number;
  leftOffset?: number;
  sourceLayer: string;
}

/*
* signals
detectors: seulement ceux sous un signal, ceux qu'on genere en sur les tiv de jonction connait pas leur pk
buffer stops
les panneaux des psl
les operational point parts
*/

export default function configKPLabelLayer(props: PlatformProps) {
  const { colors, leftOffset = -1, maxzoom = 24, minzoom = 7, sourceLayer } = props;
  const rkValue: LayerProps = {
    type: 'symbol',
    'source-layer': sourceLayer,
    filter: ['!=', '', ['get', 'extensions_sncf_kp']],
    maxzoom,
    minzoom,
    layout: {
      'text-field': ['concat', 'PK ', ['get', 'extensions_sncf_kp']],
      'text-font': ['Roboto Medium'],
      'text-size': 9,
      'text-anchor': 'right',
      'text-allow-overlap': true,
      'text-ignore-placement': true,
      'text-offset': [leftOffset, 0.1],
    },
    paint: {
      'text-color': colors.rk.text,
      'text-halo-width': 0,
      'text-halo-color': colors.rk.halo,
      'text-halo-blur': 1,
    },
  };

  return rkValue;
}
