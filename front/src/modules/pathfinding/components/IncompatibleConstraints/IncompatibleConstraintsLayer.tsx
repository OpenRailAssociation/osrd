import type { FeatureCollection, LineString } from 'geojson';
import type { FilterSpecification } from 'maplibre-gl';
import { Layer, Source } from 'react-map-gl/maplibre';

function buildLayoutFilter(
  ids: Set<string>,
  predicate: 'all' | 'any'
): FilterSpecification | undefined {
  return [
    predicate,
    ...Array.from(ids).map((id) => ['in', id, ['get', 'ids']]),
  ] as FilterSpecification;
}
interface IncompatibleConstraintsLayerProps {
  geojson: FeatureCollection<LineString, { ids: string[] }>;
  selected: Set<string>;
  hovered: Set<string>;
}

const IncompatibleConstraintsLayer = ({
  geojson,
  hovered,
  selected,
}: IncompatibleConstraintsLayerProps) => (
  <Source type="geojson" data={geojson}>
    <Layer
      id="pathfinding-incompatible-constraints"
      type="line"
      paint={{
        'line-color': 'red',
        'line-width': 4,
        'line-opacity': 0.5,
      }}
    />

    {selected.size > 0 && (
      <Layer
        id="pathfinding-incompatible-constraints-selected"
        type="line"
        filter={buildLayoutFilter(selected, 'all')}
        paint={{
          'line-color': 'brown',
          'line-width': 4,
        }}
      />
    )}

    {hovered.size > 0 && (
      <Layer
        id="pathfinding-incompatible-constraints-hovered"
        type="line"
        filter={buildLayoutFilter(hovered, 'all')}
        paint={{
          'line-color': '#009aa6',
          'line-width': 1,
          'line-gap-width': 4,
        }}
      />
    )}
  </Source>
);

export default IncompatibleConstraintsLayer;
