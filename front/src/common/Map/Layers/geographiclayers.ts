import { Theme, AnyLayer } from '../../../types';

export function geoMainLayer(theme: Theme, bigger = false): AnyLayer {
  return {
    id: 'geoMainLayer',
    type: 'line',
    paint: {
      'line-color': theme.track.major,
      'line-width': bigger ? 4 : 1,
    },
  };
}

export function geoServiceLayer(theme: Theme): AnyLayer {
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
