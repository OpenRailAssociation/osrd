import React from 'react';
import { isNil } from 'lodash';
import { useSelector } from 'react-redux';
import { Layer, LineLayer } from 'mapbox-gl';
import { Source, SymbolLayer } from 'react-map-gl';

import { RootState } from 'reducers';
import { MAP_URL } from 'common/Map/const';
import { Theme } from 'types';

import OrderedLayer from 'common/Map/Layers/OrderedLayer';
import { getInfraID } from 'reducers/osrdconf/selectors';
import { MapState } from '../../../reducers/map';

interface SpeedLimitsProps {
  geomType: string;
  colors: Theme;
  layerOrder: number;
}

export function getSpeedSectionsTag({ speedlimittag }: MapState['layersSettings']): string {
  return `speed_limit_by_tag_${speedlimittag}`;
}

export function getSpeedSectionsNameString(rawSpeed: number) {
  return Math.round(rawSpeed * 3.6);
}

export function getSpeedSectionsName(layersSettings: MapState['layersSettings']) {
  const tag = getSpeedSectionsTag(layersSettings);

  return [
    'round',
    ['*', 3.6, ['case', ['!=', ['get', tag], null], ['get', tag], ['get', 'speed_limit']]],
  ];
}

export function getSpeedSectionsFilter(
  layersSettings: MapState['layersSettings']
): Layer['filter'] {
  return layersSettings.speedlimittag === 'undefined'
    ? ['all', ['has', 'speed_limit']]
    : ['all', ['has', getSpeedSectionsTag(layersSettings)]];
}

export function getSpeedSectionsLineLayerProps({
  sourceTable,
  layersSettings,
}: {
  colors?: Theme;
  sourceTable?: string;
  layersSettings: MapState['layersSettings'];
}): Omit<LineLayer, 'id'> {
  const res: Omit<LineLayer, 'id'> = {
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
          'rgba(145, 211, 255, 1)',
          ['all', ['>', ['var', 'speed_limit'], 160], ['<=', ['var', 'speed_limit'], 220]],
          'rgba(137, 247, 216, 1)',
          ['all', ['>=', ['var', 'speed_limit'], 140], ['<=', ['var', 'speed_limit'], 160]],
          'rgba(158, 255, 119, 1)',
          ['all', ['>=', ['var', 'speed_limit'], 100], ['<', ['var', 'speed_limit'], 140]],
          'rgba(224, 254, 100, 1)',
          ['all', ['>', ['var', 'speed_limit'], 60], ['<', ['var', 'speed_limit'], 100]],
          'rgba(253, 244, 121, 1)',
          ['all', ['<=', ['var', 'speed_limit'], 60], ['>', ['var', 'speed_limit'], 30]],
          'rgba(251, 178, 134, 1)',
          ['all', ['<=', ['var', 'speed_limit'], 30]],
          'rgba(239, 81, 81, 1)',
          'rgba(185, 185, 185, 1)',
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
}): Omit<SymbolLayer, 'id'> {
  const res: Omit<SymbolLayer, 'id'> = {
    type: 'symbol',
    minzoom: 9,
    maxzoom: 24,
    layout: {
      visibility: 'visible',
      'text-font': ['Roboto Bold'],
      'symbol-placement': 'point',
      'text-field': ['to-string', getSpeedSectionsName(layersSettings)],
      'text-size': 12,
      'icon-allow-overlap': false,
      'icon-ignore-placement': false,
      'text-justify': 'left',
      'text-allow-overlap': false,
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
}): Omit<SymbolLayer, 'id'> {
  const res: Omit<SymbolLayer, 'id'> = {
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

export default function SpeedLimits(props: SpeedLimitsProps) {
  const { layersSettings } = useSelector((state: RootState) => state.map);
  const infraID = useSelector(getInfraID);
  const { geomType, colors, layerOrder } = props;

  const filter = getSpeedSectionsFilter(layersSettings);
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

  if (layersSettings.speedlimits) {
    return (
      <Source
        id={`osrd_speed_limit_${geomType}`}
        type="vector"
        url={`${MAP_URL}/layer/speed_sections/mvt/${geomType}/?infra=${infraID}`}
      >
        <OrderedLayer
          {...lineProps}
          id={`chartis/osrd_speed_limit_colors/${geomType}`}
          layerOrder={layerOrder}
        />
        <OrderedLayer
          {...pointProps}
          id={`chartis/osrd_speed_limit_points/${geomType}`}
          layerOrder={layerOrder}
        />
        <OrderedLayer
          {...textProps}
          id={`chartis/osrd_speed_limit_value/${geomType}`}
          layerOrder={layerOrder}
        />
      </Source>
    );
  }

  return null;
}
