import React from 'react';
import { useSelector } from 'react-redux';
import { Source, LayerProps } from 'react-map-gl';

import { RootState } from 'reducers';
import { MAP_URL } from 'common/Map/const';
import { Theme } from 'types';

import OrderedLayer from 'common/Map/Layers/OrderedLayer';
import { getInfraID } from 'reducers/osrdconf/selectors';

interface SpeedLimitsProps {
  geomType: string;
  colors: Theme;
  layerOrder: number;
}

export default function SpeedLimits(props: SpeedLimitsProps) {
  const { layersSettings } = useSelector((state: RootState) => state.map);
  const infraID = useSelector(getInfraID);
  const { geomType, colors, layerOrder } = props;

  const tag = `speed_limit_by_tag_${layersSettings.speedlimittag}`;
  const speedLimitByTagName = [
    'round',
    ['*', 3.6, ['case', ['!=', ['get', tag], null], ['get', tag], ['get', 'speed_limit']]],
  ];

  const speedSectionFilter =
    layersSettings.speedlimittag === 'undefined'
      ? ['all', ['has', 'speed_limit']]
      : ['all', ['has', tag]];

  const speedValuePointParams: LayerProps = {
    type: 'symbol',
    'source-layer': 'speed_sections',
    minzoom: 9,
    maxzoom: 24,
    filter: speedSectionFilter,
    layout: {
      visibility: 'visible',
      'text-font': ['Roboto Bold'],
      'symbol-placement': 'point',
      'text-field': ['to-string', speedLimitByTagName],
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

  const speedValueParams: LayerProps = {
    type: 'symbol',
    'source-layer': 'speed_sections',
    minzoom: 9,
    maxzoom: 24,
    filter: speedSectionFilter,
    layout: {
      visibility: 'visible',
      'text-font': ['Roboto Bold'],
      'symbol-placement': 'line',
      'text-field': ['concat', ['to-string', speedLimitByTagName], 'km/h'],
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

  const speedLineParams: LayerProps = {
    type: 'line',
    'source-layer': 'speed_sections',
    minzoom: 6,
    maxzoom: 24,
    filter: speedSectionFilter,
    layout: {
      visibility: 'visible',
      'line-cap': 'round',
      'line-join': 'miter',
    },
    paint: {
      'line-color': [
        'let',
        'speed_limit',
        speedLimitByTagName,
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

  if (layersSettings.speedlimits) {
    return (
      <Source
        id={`osrd_speed_limit_${geomType}`}
        type="vector"
        url={`${MAP_URL}/layer/speed_sections/mvt/${geomType}/?infra=${infraID}`}
      >
        <OrderedLayer
          {...speedLineParams}
          id={`chartis/osrd_speed_limit_colors/${geomType}`}
          layerOrder={layerOrder}
        />
        <OrderedLayer
          {...speedValuePointParams}
          id={`chartis/osrd_speed_limit_points/${geomType}`}
          layerOrder={layerOrder}
        />
        <OrderedLayer
          {...speedValueParams}
          id={`chartis/osrd_speed_limit_value/${geomType}`}
          layerOrder={layerOrder}
        />
      </Source>
    );
  }
  return null;
}
