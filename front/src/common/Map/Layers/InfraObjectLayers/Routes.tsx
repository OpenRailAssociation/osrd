import type { Geometry } from 'geojson';
import { isNil } from 'lodash';
import { Source } from 'react-map-gl/maplibre';
import type {
  CircleLayerSpecification,
  LineLayerSpecification,
  SymbolLayerSpecification,
} from 'react-map-gl/maplibre';

import { MAP_URL } from 'common/Map/const';
import type { Theme } from 'common/Map/theme';
import type { OmitLayer } from 'types';

import { DEFAULT_HALO_WIDTH, getAllowOverlap, getDynamicTextSize } from '../commonLayers';
import OrderedLayer from '../OrderedLayer';

type RoutesProps = {
  colors: Theme;
  layerOrder: number;
  infraID: number | undefined;
  highlightedArea?: Geometry;
};

export function getRoutesLineLayerProps(params: {
  colors: Theme;
  sourceTable?: string;
  highlightedArea?: Geometry;
}): OmitLayer<LineLayerSpecification> {
  const res: OmitLayer<LineLayerSpecification> = {
    type: 'line',
    minzoom: 6,
    maxzoom: 24,
    layout: {
      visibility: 'visible',
      // 'line-cap': 'round',
      // 'line-join': 'miter',
    },
    filter: params.highlightedArea ? ['within', params.highlightedArea] : true,
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
  highlightedArea?: Geometry;
}): OmitLayer<CircleLayerSpecification> {
  const res: OmitLayer<CircleLayerSpecification> = {
    type: 'circle',
    filter: params.highlightedArea ? ['within', params.highlightedArea] : true,
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
  highlightedArea?: Geometry;
}): OmitLayer<SymbolLayerSpecification> {
  const res: OmitLayer<SymbolLayerSpecification> = {
    type: 'symbol',
    minzoom: 9,
    maxzoom: 24,
    layout: {
      visibility: 'visible',
      'text-font': ['IBMPlexSans-Bold'],
      'symbol-placement': 'line-center',
      'text-field': ['slice', ['get', 'id'], 6],
      'text-size': getDynamicTextSize({ fromSize: 12, toSize: 18 }),
      'text-justify': 'center',
      'text-allow-overlap': getAllowOverlap(),
      'text-ignore-placement': true,
      'text-offset': [0, -0.5],
    },
    filter: params.highlightedArea ? ['within', params.highlightedArea] : true,
    paint: {
      'text-color': params.colors.routes.text,
      'text-halo-color': params.colors.routes.halo,
      'text-halo-width': DEFAULT_HALO_WIDTH,
    },
  };

  if (typeof params.sourceTable === 'string') res['source-layer'] = params.sourceTable;
  return res;
}

export default function Routes({ colors, layerOrder, infraID, highlightedArea }: RoutesProps) {
  const lineProps = getRoutesLineLayerProps({ colors, sourceTable: 'routes', highlightedArea });
  const pointProps = getRoutesPointLayerProps({ colors, sourceTable: 'routes', highlightedArea });
  const textProps = getRoutesTextLayerProps({ colors, sourceTable: 'routes', highlightedArea });

  if (isNil(infraID)) return null;
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
