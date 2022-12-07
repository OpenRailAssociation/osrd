import { Theme, AnyLayer } from '../../../types';

function definePaint(theme: Theme, showOrthoPhoto: boolean) {
  return showOrthoPhoto
    ? {
        'line-color': theme.track.major,
        'line-width': 4,
      }
    : {
        'line-color': theme.track.major,
        'line-width': 1,
      };
}

export function geoMainLayer(theme: Theme, showOrthoPhoto = false): AnyLayer {
  return {
    id: 'geoMainLayer',
    type: 'line',
    paint: definePaint(theme, showOrthoPhoto),
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
