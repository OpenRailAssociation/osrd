import React from 'react';
import { Source, LayerProps } from 'react-map-gl';

import OrderedLayer from 'common/Map/Layers/OrderedLayer';
import { OSM_URL } from 'common/Map/const';

import { Theme } from 'types';

interface PlatformProps {
  colors: Theme;
  layerOrder: number;
}

function Platform(props: PlatformProps) {
  const { colors, layerOrder } = props;

  const platformParams: LayerProps = {
    id: 'osm/platform',
    type: 'fill-extrusion',
    source: 'openmaptiles',
    'source-layer': 'transportation',
    filter: [
      'all',
      ['==', '$type', 'Polygon'],
      ['==', 'class', 'path'],
      ['==', 'subclass', 'platform'],
    ],
    paint: {
      'fill-extrusion-color': colors.platform.fill,
      'fill-extrusion-height': 2,
      'fill-extrusion-base': 1,
      'fill-extrusion-opacity': 0.4,
    },
  };

  return (
    <Source id="platform" type="vector" url={OSM_URL} source-layer="transportation">
      <OrderedLayer {...platformParams} layerOrder={layerOrder} />
    </Source>
  );
}

export default Platform;
