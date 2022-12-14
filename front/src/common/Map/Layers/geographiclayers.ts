import { Theme, AnyLayer } from '../../../types';

function definePaint(theme: Theme, bigger: boolean) {
  return bigger
    ? {
        'line-color': theme.track.major,
        'line-width': 4,
      }
    : {
        'line-color': theme.track.major,
        'line-width': 1,
      };
}

export function geoMainLayer(theme: Theme, bigger = false): AnyLayer {
  return {
    id: 'geoMainLayer',
    type: 'line',
    paint: definePaint(theme, bigger),
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
