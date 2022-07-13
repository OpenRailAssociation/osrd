import { LayerProps } from 'react-map-gl';

import { Theme } from '../../../types';

export function geoMainLayer(theme: Theme): LayerProps {
  return {
    id: 'geoMainLayer',
    type: 'line',
    paint: {
      'line-color': ['match', ['get', 'type_voie'], 'VPL', theme.track.major, theme.track.major],
      'line-width': ['match', ['get', 'type_voie'], 'VPL', 2, 1],
    },
  };
}

export function geoServiceLayer(theme: Theme): LayerProps {
  return {
    id: 'geoServiceLayer',
    type: 'line',
    filter: ['!=', 'type_voie', 'VP'],
    paint: {
      'line-color': theme.track.minor,
      'line-width': 1,
    },
  };
}
