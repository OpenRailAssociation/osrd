import type { LineLayer } from 'react-map-gl/maplibre';
import type { Theme } from 'types';

export default function geoMainLayer(theme: Theme, bigger = false): Omit<LineLayer, 'source'> {
  return {
    id: 'geoMainLayer',
    type: 'line',
    minzoom: 5,
    paint: {
      'line-color': theme.track.major,
      'line-width': bigger ? 4 : 1,
    },
  };
}
