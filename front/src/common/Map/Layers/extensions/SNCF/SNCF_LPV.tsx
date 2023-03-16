/* eslint-disable react/jsx-pascal-case */
import React from 'react';
import { useSelector } from 'react-redux';
import { Source, LayerProps } from 'react-map-gl';
import { useTranslation } from 'react-i18next';

import { RootState } from 'reducers';
import { MAP_URL } from 'common/Map/const';
import { Theme } from 'types';

import OrderedLayer from 'common/Map/Layers/OrderedLayer';
import { getInfraID } from 'reducers/osrdconf/selectors';

import SNCF_LPV_Panels from './SNCF_LPV_PANELS';

interface SNCF_LPVProps {
  geomType: string;
  colors: Theme;
  layerOrder?: number;
}

export default function SNCF_LPV(props: SNCF_LPVProps) {
  const { t } = useTranslation('map-settings');
  const { layersSettings } = useSelector((state: RootState) => state.map);
  const infraID = useSelector(getInfraID);
  const { geomType, colors, layerOrder } = props;

  const tag = `speed_limit_by_tag_${layersSettings.speedlimittag}`;
  const speedLimitByTagName = [
    'round',
    ['*', 3.6, ['case', ['!=', ['get', tag], null], ['get', tag], ['get', 'speed_limit']]],
  ];

  const speedSectionFilter = ['any', ['has', 'speed_limit'], ['has', tag]];

  const speedValueParams: LayerProps = {
    type: 'symbol',
    'source-layer': 'lpv',
    minzoom: 9,
    maxzoom: 24,
    filter: speedSectionFilter,
    layout: {
      visibility: 'visible',
      'text-font': ['Roboto Bold'],
      'symbol-placement': 'line-center',
      'text-field': [
        'concat',
        t('zone').toUpperCase(),
        ' ',
        ['to-string', speedLimitByTagName],
        'km/h',
      ],
      'text-size': 10,
      'text-justify': 'left',
      'text-allow-overlap': false,
      'text-ignore-placement': false,
      'text-offset': [0, -1],
    },
    paint: {
      'text-color': colors.lpv.text,
      'text-halo-color': colors.lpv.halo,
      'text-halo-width': 1,
      'text-opacity': 1,
    },
  };

  const speedLineBGParams: LayerProps = {
    type: 'line',
    'source-layer': 'lpv',
    minzoom: 6,
    maxzoom: 24,
    filter: speedSectionFilter,
    layout: {
      visibility: 'visible',
      'line-cap': ['step', ['zoom'], 'round', 15, 'square'],
    },
    paint: {
      'line-color': '#747678',
      'line-width': 3,
      'line-offset': 0,
      'line-opacity': 1,
      'line-gap-width': 7,
    },
  };

  const speedLineParams: LayerProps = {
    type: 'line',
    'source-layer': 'lpv',
    minzoom: 6,
    maxzoom: 24,
    filter: speedSectionFilter,
    layout: {
      visibility: 'visible',
      'line-cap': ['step', ['zoom'], 'round', 15, 'square'],
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
      'line-width': 3,
      'line-offset': 0,
      'line-opacity': 1,
      'line-gap-width': 7,
      'line-dasharray': [1, 2],
    },
  };

  if (layersSettings.sncf_lpv) {
    return (
      <>
        <Source
          id={`osrd_sncf_lpv_${geomType}`}
          type="vector"
          url={`${MAP_URL}/layer/lpv/mvt/${geomType}/?infra=${infraID}`}
        >
          <OrderedLayer
            {...speedValueParams}
            id={`chartis/osrd_sncf_lpv_value/${geomType}`}
            layerOrder={layerOrder}
          />
          <OrderedLayer
            {...speedLineBGParams}
            id={`chartis/osrd_sncf_lpv_colors_bg/${geomType}`}
            layerOrder={layerOrder}
          />
          <OrderedLayer
            {...speedLineParams}
            id={`chartis/osrd_sncf_lpv_colors/${geomType}`}
            layerOrder={layerOrder}
          />
        </Source>
        <SNCF_LPV_Panels geomType={geomType} layerOrder={layerOrder} />
      </>
    );
  }
  return null;
}
