import React from 'react';
import { useSelector } from 'react-redux';
import { CircleLayer, LineLayer, Source, SymbolLayer } from 'react-map-gl';

import { RootState } from 'reducers';
import { Theme } from 'types';
import { MAP_URL } from 'common/Map/const';

import OrderedLayer from 'common/Map/Layers/OrderedLayer';

interface RoutesProps {
  colors: Theme;
  geomType: string;
  layerOrder: number;
}

export function getRoutesLineLayerProps(params: {
  colors: Theme;
  sourceTable?: string;
}): Omit<LineLayer, 'id'> {
  const res: Omit<LineLayer, 'id'> = {
    type: 'line',
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

  if (typeof params.sourceTable === 'string') res['source-layer'] = params.sourceTable;
  return res;
}

export function getRoutesPointLayerProps(params: {
  colors: Theme;
  sourceTable?: string;
}): Omit<CircleLayer, 'id'> {
  const res: Omit<CircleLayer, 'id'> = {
    type: 'circle',
    paint: {
      'circle-stroke-color': 'rgba(255, 182, 18, 0.5)',
      'circle-color': 'rgba(255, 182, 18, 0.5)',
      'circle-radius': 4,
    },
  };

  if (typeof params.sourceTable === 'string') res['source-layer'] = params.sourceTable;
  return res;
}

export function getRoutesTextLayerProps(params: {
  colors: Theme;
  sourceTable?: string;
}): Omit<SymbolLayer, 'id'> {
  const res: Omit<SymbolLayer, 'id'> = {
    type: 'symbol',
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
      'text-color': params.colors.routes.text,
      'text-halo-color': params.colors.routes.halo,
      'text-halo-width': 1,
      'text-opacity': 1,
    },
  };

  if (typeof params.sourceTable === 'string') res['source-layer'] = params.sourceTable;
  return res;
}

export default function Routes(props: RoutesProps) {
  const { geomType, colors, layerOrder } = props;
  const { layersSettings } = useSelector((state: RootState) => state.map);
  const { infraID } = useSelector((state: RootState) => state.osrdconf);

  const lineProps = getRoutesLineLayerProps({ colors, sourceTable: 'routes' });
  const pointProps = getRoutesPointLayerProps({ colors, sourceTable: 'routes' });
  const textProps = getRoutesTextLayerProps({ colors, sourceTable: 'routes' });

  return layersSettings.routes ? (
    <Source
      id={`osrd_routes_${geomType}`}
      type="vector"
      url={`${MAP_URL}/layer/routes/mvt/${geomType}/?infra=${infraID}`}
    >
      <OrderedLayer
        {...lineProps}
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
