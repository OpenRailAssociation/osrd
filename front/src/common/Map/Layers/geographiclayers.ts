import { LineLayer } from 'react-map-gl/maplibre';
import { Theme } from '../../../types';

export function geoMainLayer(theme: Theme, bigger = false): Omit<LineLayer, 'source'> {
  return {
    id: 'geoMainLayer',
    type: 'line',
    paint: {
      'line-color': theme.track.major,
      'line-width': bigger ? 4 : 1,
    },
  };
}

export function geoServiceLayer(theme: Theme): Omit<LineLayer, 'source'> {
  return {
    id: 'geoServiceLayer',
    type: 'line',
    filter: ['==', 'type_voie', 'VS'],
    paint: {
      'line-color': theme.track.minor,
      'line-width': 1,
    },
  };
}
