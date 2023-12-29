import React from 'react';
import { Source, LayerProps } from 'react-map-gl/maplibre';

import OrderedLayer from 'common/Map/Layers/OrderedLayer';
import { OSM_URL } from 'common/Map/const';

import { Theme } from 'types';
import { useSelector } from 'react-redux';
import { RootState } from 'reducers';

interface PlatformsProps {
  colors: Theme;
  layerOrder?: number;
}

export function Platforms(props: PlatformsProps) {
  const { colors, layerOrder } = props;

  const platformsParams: LayerProps = {
    id: 'osm/platforms',
    type: 'fill',
    source: 'openmaptiles',
    'source-layer': 'transportation',
    filter: [
      'all',
      ['==', '$type', 'Polygon'],
      ['==', 'class', 'path'],
      ['==', 'subclass', 'platform'],
    ],
    paint: {
      'fill-color': colors.platform.fill,
    },
  };

  return (
    <Source id="platforms" type="vector" url={OSM_URL} source-layer="transportation">
      <OrderedLayer {...platformsParams} layerOrder={layerOrder} />
    </Source>
  );
}

function PlatformsState(props: PlatformsProps) {
  const { layersSettings } = useSelector((state: RootState) => state.map);
  return layersSettings.platforms && <Platforms {...props} />;
}

export default PlatformsState;
