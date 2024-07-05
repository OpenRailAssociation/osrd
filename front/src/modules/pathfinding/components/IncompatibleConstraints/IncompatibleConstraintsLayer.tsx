import React, { useMemo, type FC } from 'react';

import { featureCollection } from '@turf/helpers';
import { Layer, Source } from 'react-map-gl/maplibre';

import type { IncompatibleConstraintItemEnhanced } from './type';

interface IncompatibleConstraintsLayerProps {
  data: Array<IncompatibleConstraintItemEnhanced>;
}
const IncompatibleConstraintsLayer: FC<IncompatibleConstraintsLayerProps> = ({ data }) => {
  const collections = useMemo(() => featureCollection(data.map((e) => e.geometry)), [data]);

  return (
    <Source type="geojson" data={collections}>
      <Layer
        id="pathfinding-incompatible-constraints"
        type="line"
        paint={{
          'line-color': 'red',
          'line-width': 4,
          'line-opacity': 0.5,
        }}
      />
      <Layer
        id="pathfinding-incompatible-constraints-highlighted"
        type="line"
        filter={['==', ['get', 'highlighted'], true]}
        paint={{
          'line-color': 'brown',
          'line-width': 4,
        }}
      />
    </Source>
  );
};

export default IncompatibleConstraintsLayer;
