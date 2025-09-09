import type { Geometry } from 'geojson';
import { isNil } from 'lodash';
import type { ExpressionSpecification, FilterSpecification } from 'maplibre-gl';
import { Source } from 'react-map-gl/maplibre';
import type { SymbolLayerSpecification, LineLayerSpecification } from 'react-map-gl/maplibre';

import { MAP_URL } from 'common/Map/const';
import type { Theme } from 'common/Map/theme';
import type { LayersSettings, MapSettings } from 'reducers/commonMap/types';
import type { OmitLayer } from 'types';

import { DEFAULT_HALO_WIDTH, getAllowOverlap, getDynamicTextSize } from '../commonLayers';
import OrderedLayer from '../OrderedLayer';

type SpeedLimitsProps = {
  colors: Theme;
  layerOrder: number;
  punctualLayerOrder: number;
  infraID?: number;
  layersSettings: MapSettings['layersSettings'];
  highlightedArea?: Geometry;
};

export function getSpeedSectionsTag({ speedlimittag }: LayersSettings): string {
  return speedlimittag !== null ? `speed_limit_by_tag_${speedlimittag}` : 'null';
}

export function getSpeedSectionsNameString(rawSpeed: number) {
  return Math.round(rawSpeed * 3.6);
}

export function getSpeedSectionsName(layersSettings: LayersSettings): ExpressionSpecification {
  const tag = getSpeedSectionsTag(layersSettings);

  return ['round', ['*', 3.6, ['case', ['!=', tag, 'null'], ['get', tag], ['get', 'speed_limit']]]];
}

export function getFilterBySpeedSectionsTag(
  layersSettings: LayersSettings,
  highlightedArea?: Geometry
): FilterSpecification {
  return [
    'all',
    isNil(layersSettings.speedlimittag)
      ? ['has', 'speed_limit']
      : ['has', getSpeedSectionsTag(layersSettings)],
    highlightedArea ? ['within', highlightedArea] : true,
  ];
}

export function getSpeedSectionsLineLayerProps({
  colors,
  sourceTable,
  layersSettings,
}: {
  colors: Theme;
  sourceTable?: string;
  layersSettings: LayersSettings;
}): OmitLayer<LineLayerSpecification> {
  const res: OmitLayer<LineLayerSpecification> = {
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
  layersSettings: LayersSettings;
}): OmitLayer<SymbolLayerSpecification> {
  const res: OmitLayer<SymbolLayerSpecification> = {
    type: 'symbol',
    minzoom: 9,
    maxzoom: 24,
    layout: {
      visibility: 'visible',
      'text-font': ['IBMPlexSans-Bold'],
      'symbol-placement': 'point',
      'text-field': ['to-string', getSpeedSectionsName(layersSettings)],
      'text-size': getDynamicTextSize({ fromSize: 12, toSize: 18 }),
      'icon-allow-overlap': getAllowOverlap(15),
      'icon-ignore-placement': false,
      'text-justify': 'left',
      'text-allow-overlap': getAllowOverlap(15),
      'text-ignore-placement': false,
    },
    paint: {
      'text-color': colors.speed.pointtext,
      'text-halo-color': colors.speed.pointhalo,
      'text-halo-width': DEFAULT_HALO_WIDTH,
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
  layersSettings: LayersSettings;
}): OmitLayer<SymbolLayerSpecification> {
  const res: OmitLayer<SymbolLayerSpecification> = {
    type: 'symbol',
    minzoom: 9,
    maxzoom: 24,
    layout: {
      visibility: 'visible',
      'text-font': ['IBMPlexSans-Bold'],
      'symbol-placement': 'line',
      'text-field': ['concat', ['to-string', getSpeedSectionsName(layersSettings)], 'km/h'],
      'text-size': getDynamicTextSize({ fromSize: 9, toSize: 15 }),
      'text-justify': 'left',
      'text-allow-overlap': getAllowOverlap(),
      'text-ignore-placement': false,
    },
    paint: {
      'text-color': colors.speed.text,
      'text-halo-color': colors.speed.halo,
      'text-halo-width': DEFAULT_HALO_WIDTH,
      'text-opacity': 1,
    },
  };

  if (!isNil(sourceTable)) res['source-layer'] = sourceTable;

  return res;
}

export default function SpeedLimits({
  colors,
  layerOrder,
  punctualLayerOrder,
  infraID,
  layersSettings,
  highlightedArea,
}: SpeedLimitsProps) {
  const filter = getFilterBySpeedSectionsTag(layersSettings, highlightedArea);
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

  if (isNil(infraID)) return null;
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
        layerOrder={punctualLayerOrder}
      />
      <OrderedLayer
        {...textProps}
        id="chartis/osrd_speed_limit_value/geo"
        layerOrder={layerOrder}
      />
    </Source>
  );
}
