import { isNil } from 'lodash';
import type { ExpressionSpecification, FilterSpecification } from 'maplibre-gl';
import { Source } from 'react-map-gl/maplibre';
import type { SymbolLayer, LineLayer } from 'react-map-gl/maplibre';
import { useSelector } from 'react-redux';

import { MAP_URL } from 'common/Map/const';
import OrderedLayer from 'common/Map/Layers/OrderedLayer';
import type { RootState } from 'reducers';
import type { MapState } from 'reducers/map';
import type { Theme, OmitLayer } from 'types';

interface SpeedLimitsProps {
  colors: Theme;
  layerOrder: number;
  infraID: number | undefined;
}

export function getSpeedSectionsTag({ speedlimittag }: MapState['layersSettings']): string {
  return speedlimittag !== null ? `speed_limit_by_tag_${speedlimittag}` : 'null';
}

export function getSpeedSectionsNameString(rawSpeed: number) {
  return Math.round(rawSpeed * 3.6);
}

export function getSpeedSectionsName(
  layersSettings: MapState['layersSettings']
): ExpressionSpecification {
  const tag = getSpeedSectionsTag(layersSettings);

  return ['round', ['*', 3.6, ['case', ['!=', tag, 'null'], ['get', tag], ['get', 'speed_limit']]]];
}

export function getFilterBySpeedSectionsTag(
  layersSettings: MapState['layersSettings']
): FilterSpecification {
  return isNil(layersSettings.speedlimittag)
    ? ['has', 'speed_limit']
    : ['has', getSpeedSectionsTag(layersSettings)];
}

export function getSpeedSectionsLineLayerProps({
  colors,
  sourceTable,
  layersSettings,
}: {
  colors: Theme;
  sourceTable?: string;
  layersSettings: MapState['layersSettings'];
}): OmitLayer<LineLayer> {
  const res: OmitLayer<LineLayer> = {
    type: 'line',
    minzoom: 6,
    maxzoom: 24,
    layout: {
      visibility: 'visible',
      'line-cap': 'round',
      'line-join': 'miter',
    },
    paint: {
      'line-color': [
        'let',
        'speed_limit',
        getSpeedSectionsName(layersSettings),
        [
          'case',
          ['all', ['>', ['var', 'speed_limit'], 220]],
          colors.speed.speedOver220,
          ['all', ['>', ['var', 'speed_limit'], 160], ['<=', ['var', 'speed_limit'], 220]],
          colors.speed.speed220,
          ['all', ['>=', ['var', 'speed_limit'], 140], ['<=', ['var', 'speed_limit'], 160]],
          colors.speed.speed160,
          ['all', ['>=', ['var', 'speed_limit'], 100], ['<', ['var', 'speed_limit'], 140]],
          colors.speed.speed140,
          ['all', ['>', ['var', 'speed_limit'], 60], ['<', ['var', 'speed_limit'], 100]],
          colors.speed.speed100,
          ['all', ['<=', ['var', 'speed_limit'], 60], ['>', ['var', 'speed_limit'], 30]],
          colors.speed.speed60,
          ['all', ['<=', ['var', 'speed_limit'], 30]],
          colors.speed.speed30,
          colors.speed.speedNone,
        ],
      ],
      'line-width': 4,
      'line-offset': 0,
      'line-opacity': 1,
    },
  };

  if (!isNil(sourceTable)) res['source-layer'] = sourceTable;

  return res;
}

export function getSpeedSectionsPointLayerProps({
  colors,
  sourceTable,
  layersSettings,
}: {
  colors: Theme;
  sourceTable?: string;
  layersSettings: MapState['layersSettings'];
}): OmitLayer<SymbolLayer> {
  const res: OmitLayer<SymbolLayer> = {
    type: 'symbol',
    minzoom: 9,
    maxzoom: 24,
    layout: {
      visibility: 'visible',
      'text-font': ['Roboto Bold'],
      'symbol-placement': 'point',
      'text-field': ['to-string', getSpeedSectionsName(layersSettings)],
      'text-size': 12,
      'icon-allow-overlap': ['step', ['zoom'], false, 15, true],
      'icon-ignore-placement': false,
      'text-justify': 'left',
      'text-allow-overlap': ['step', ['zoom'], false, 15, true],
      'text-ignore-placement': false,
    },
    paint: {
      'text-color': colors.speed.pointtext,
      'text-halo-color': colors.speed.pointhalo,
      'text-halo-width': 5,
      'text-opacity': 1,
    },
  };

  if (!isNil(sourceTable)) res['source-layer'] = sourceTable;

  return res;
}

export function getSpeedSectionsTextLayerProps({
  colors,
  sourceTable,
  layersSettings,
}: {
  colors: Theme;
  sourceTable?: string;
  layersSettings: MapState['layersSettings'];
}): OmitLayer<SymbolLayer> {
  const res: OmitLayer<SymbolLayer> = {
    type: 'symbol',
    minzoom: 9,
    maxzoom: 24,
    layout: {
      visibility: 'visible',
      'text-font': ['Roboto Bold'],
      'symbol-placement': 'line',
      'text-field': ['concat', ['to-string', getSpeedSectionsName(layersSettings)], 'km/h'],
      'text-size': 9,
      'text-justify': 'left',
      'text-allow-overlap': false,
      'text-ignore-placement': false,
    },
    paint: {
      'text-color': colors.speed.text,
      'text-halo-color': colors.speed.halo,
      'text-halo-width': 1,
      'text-opacity': 1,
    },
  };

  if (!isNil(sourceTable)) res['source-layer'] = sourceTable;

  return res;
}

export default function SpeedLimits({ colors, layerOrder, infraID }: SpeedLimitsProps) {
  const { layersSettings } = useSelector((state: RootState) => state.map);

  const filter = getFilterBySpeedSectionsTag(layersSettings);
  const lineProps = {
    ...getSpeedSectionsLineLayerProps({
      colors,
      layersSettings,
      sourceTable: 'speed_sections',
    }),
    filter,
  };
  const pointProps = {
    ...getSpeedSectionsPointLayerProps({
      colors,
      layersSettings,
      sourceTable: 'speed_sections',
    }),
    filter,
  };
  const textProps = {
    ...getSpeedSectionsTextLayerProps({
      colors,
      layersSettings,
      sourceTable: 'speed_sections',
    }),
    filter,
  };

  if (!layersSettings.speedlimits || isNil(infraID)) return null;
  return (
    <Source
      id="osrd_speed_limit_geo"
      type="vector"
      url={`${MAP_URL}/layer/speed_sections/mvt/geo/?infra=${infraID}`}
    >
      <OrderedLayer
        {...lineProps}
        id="chartis/osrd_speed_limit_colors/geo"
        layerOrder={layerOrder}
      />
      <OrderedLayer
        {...pointProps}
        id="chartis/osrd_speed_limit_points/geo"
        layerOrder={layerOrder}
      />
      <OrderedLayer
        {...textProps}
        id="chartis/osrd_speed_limit_value/geo"
        layerOrder={layerOrder}
      />
    </Source>
  );
}
