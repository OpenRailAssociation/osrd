import { isNil } from 'lodash';
import { Source } from 'react-map-gl/maplibre';
import type { CircleLayer, LineLayer, SymbolLayer } from 'react-map-gl/maplibre';
import { useSelector } from 'react-redux';

import { MAP_URL } from 'common/Map/const';
import OrderedLayer from 'common/Map/Layers/OrderedLayer';
import { getMap } from 'reducers/map/selectors';
import type { Theme, OmitLayer } from 'types';

interface RoutesProps {
  colors: Theme;
  layerOrder: number;
  infraID: number | undefined;
}

export function getRoutesLineLayerProps(params: {
  colors: Theme;
  sourceTable?: string;
}): OmitLayer<LineLayer> {
  const res: OmitLayer<LineLayer> = {
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
}): OmitLayer<CircleLayer> {
  const res: OmitLayer<CircleLayer> = {
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
}): OmitLayer<SymbolLayer> {
  const res: OmitLayer<SymbolLayer> = {
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

export default function Routes({ colors, layerOrder, infraID }: RoutesProps) {
  const { layersSettings } = useSelector(getMap);

  const lineProps = getRoutesLineLayerProps({ colors, sourceTable: 'routes' });
  const pointProps = getRoutesPointLayerProps({ colors, sourceTable: 'routes' });
  const textProps = getRoutesTextLayerProps({ colors, sourceTable: 'routes' });

  if (!layersSettings.routes || isNil(infraID)) return null;
  return (
    <Source
      id="osrd_routes_geo"
      type="vector"
      url={`${MAP_URL}/layer/routes/mvt/geo/?infra=${infraID}`}
    >
      <OrderedLayer {...lineProps} id="chartis/osrd_routes_line/geo" layerOrder={layerOrder} />
      <OrderedLayer {...pointProps} id="chartis/osrd_routes_point/geo" layerOrder={layerOrder} />
      <OrderedLayer {...textProps} id="chartis/osrd_routes_text/geo" layerOrder={layerOrder} />
    </Source>
  );
}
