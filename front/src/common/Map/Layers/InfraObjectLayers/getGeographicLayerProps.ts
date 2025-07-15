import type { Geometry } from 'geojson';
import type { LineLayer } from 'react-map-gl/maplibre';

import type { Theme } from 'types';

export default function geoMainLayer(
  theme: Theme,
  bigger = false,
  highlightedArea: Geometry | undefined = undefined
): Omit<LineLayer, 'source'> {
  return {
    id: 'geoMainLayer',
    type: 'line',
    minzoom: 5,
    paint: {
      'line-color': highlightedArea
        ? ['case', ['within', highlightedArea], theme.track.major, theme.muted.color]
        : theme.track.major,
      'line-width': bigger ? 4 : 1,
    },
  };
}
