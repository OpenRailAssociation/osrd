import React from 'react';
import { useSelector } from 'react-redux';
import { LayerProps, Source } from 'react-map-gl';

import { RootState } from 'reducers';
import { Theme } from 'types';
import { MAP_URL } from 'common/Map/const';

import OrderedLayer from 'common/Map/Layers/OrderedLayer';

interface RoutesProps {
  colors: Theme;
  geomType: string;
  layerOrder: number;
}

export default function Routes(props: RoutesProps) {
  const { geomType, colors, layerOrder } = props;
  const { layersSettings } = useSelector((state: RootState) => state.map);
  const { infraID } = useSelector((state: RootState) => state.osrdconf);

  const lineprops: LayerProps = {
    type: 'line',
    'source-layer': 'routes',
    minzoom: 6,
    maxzoom: 24,
    layout: {
      visibility: 'visible',
      // 'line-cap': 'round',
      // 'line-join': 'miter',
    },
    paint: {
      'line-color': '#e05206',
      'line-width': 1,
      'line-offset': 4,
      'line-opacity': 1,
      'line-dasharray': [1, 2],
    },
  };

  const pointProps: LayerProps = {
    type: 'circle',
    'source-layer': 'routes',
    paint: {
      'circle-stroke-color': 'rgba(255, 182, 18, 0.5)',
      'circle-color': 'rgba(255, 182, 18, 0.5)',
      'circle-radius': 4,
    },
  };

  const textProps: LayerProps = {
    type: 'symbol',
    'source-layer': 'routes',
    minzoom: 9,
    maxzoom: 24,
    layout: {
      visibility: 'visible',
      'text-font': ['Roboto Bold'],
      'symbol-placement': 'line-center',
      'text-field': ['slice', ['get', 'id'], 6],
      'text-size': 12,
      'text-justify': 'center',
      'text-allow-overlap': true,
      'text-ignore-placement': true,
      'text-offset': [0, -0.5],
    },
    paint: {
      'text-color': colors.routes.text,
      'text-halo-color': colors.routes.halo,
      'text-halo-width': 1,
      'text-opacity': 1,
    },
  };

  return layersSettings.routes ? (
    <Source
      id={`osrd_routes_${geomType}`}
      type="vector"
      url={`${MAP_URL}/layer/routes/mvt/${geomType}/?infra=${infraID}`}
    >
      <OrderedLayer
        {...lineprops}
        id={`chartis/osrd_routes_line/${geomType}`}
        layerOrder={layerOrder}
      />
      <OrderedLayer
        {...pointProps}
        id={`chartis/osrd_routes_point/${geomType}`}
        layerOrder={layerOrder}
      />
      <OrderedLayer
        {...textProps}
        id={`chartis/osrd_routes_text/${geomType}`}
        layerOrder={layerOrder}
      />
    </Source>
  ) : null;
}
