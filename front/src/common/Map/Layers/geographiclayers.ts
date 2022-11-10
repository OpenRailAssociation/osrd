import { LayerProps } from 'react-map-gl';
import { useSelector } from 'react-redux';
import { RootState } from 'reducers';

import { Theme } from '../../../types';

const definePaint = (theme: Theme) => {
  const { showOrthoPhoto } = useSelector((state: RootState) => state.map);
  return showOrthoPhoto
    ? {
        'line-color': theme.track.major,
        'line-width': 4,
      }
    : {
        'line-color': theme.track.major,
        'line-width': 1,
      };
};

export function geoMainLayer(theme: Theme): LayerProps {
  return {
    id: 'geoMainLayer',
    type: 'line',
    paint: definePaint(theme),
  };
}

export function geoServiceLayer(theme: Theme): LayerProps {
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
