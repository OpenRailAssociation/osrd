import type { Geometry } from 'geojson';
import type { ColorSpecification, DataDrivenPropertyValueSpecification } from 'maplibre-gl';
import type { LineLayerSpecification } from 'react-map-gl/maplibre';

import type { Theme } from 'common/Map/theme';

function getColorByHighlighted(data: {
  highlightedArea?: Geometry;
  highlightedTrackSections?: string[];
  inColor: string;
  outColor: string;
}): DataDrivenPropertyValueSpecification<ColorSpecification> {
  if (data.highlightedTrackSections && data.highlightedTrackSections.length > 0)
    return [
      'case',
      ['in', ['get', 'id'], ['literal', data.highlightedTrackSections]],
      data.inColor,
      data.outColor,
    ];

  if (data.highlightedArea)
    return ['case', ['within', data.highlightedArea], data.inColor, data.outColor];

  return data.inColor;
}

export default function geoMainLayer(
  theme: Theme,
  bigger = false,
  highlightedArea: Geometry | undefined = undefined,
  highlightedTrackSections: string[] | undefined = undefined
): Omit<LineLayerSpecification, 'source'> {
  return {
    id: 'geoMainLayer',
    type: 'line',
    minzoom: 5,
    paint: {
      'line-color': getColorByHighlighted({
        highlightedArea,
        highlightedTrackSections,
        inColor: theme.track.major,
        outColor: theme.muted.color,
      }),
      'line-width': bigger ? 4 : ['interpolate', ['linear'], ['zoom'], 5, 0.5, 7.5, 1],
    },
  };
}
