import type { Geometry } from 'geojson';
import type { LineLayerSpecification } from 'react-map-gl/maplibre';

import type { Theme } from 'common/Map/theme';

export default function geoMainLayer(
  theme: Theme,
  bigger = false,
  highlightedArea: Geometry | undefined = undefined
): Omit<LineLayerSpecification, 'source'> {
  return {
    id: 'geoMainLayer',
    type: 'line',
    minzoom: 5,
    paint: {
      'line-color': highlightedArea
        ? ['case', ['within', highlightedArea], theme.track.major, theme.muted.color]
        : theme.track.major,
      'line-width': bigger ? 4 : ['interpolate', ['linear'], ['zoom'], 5, 0.5, 7.5, 1],
    },
  };
}
