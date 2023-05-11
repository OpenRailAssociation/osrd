/* eslint-disable react/jsx-pascal-case */
import React from 'react';
import { useSelector } from 'react-redux';
import { Source } from 'react-map-gl';

import { RootState } from 'reducers';
import { MAP_URL } from 'common/Map/const';
import { SourceLayer, LineLayer, SymbolLayer, Theme } from 'types';

import OrderedLayer from 'common/Map/Layers/OrderedLayer';
import { getInfraID } from 'reducers/osrdconf/selectors';

import { MapState } from 'reducers/map';
import { isNil } from 'lodash';
import { Layer } from 'mapbox-gl';
import { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import SNCF_LPV_Panels from './SNCF_LPV_PANELS';
import { getSpeedSectionsTag, getSpeedSectionsName } from '../../SpeedLimits';

interface SNCF_LPVProps {
  geomType: SourceLayer;
  colors: Theme;
  layerOrder?: number;
}

export function getLPVFilter(layersSettings: MapState['layersSettings']): Layer['filter'] {
  return ['any', ['has', 'speed_limit'], ['has', getSpeedSectionsTag(layersSettings)]];
}

export function getLPVSpeedValueLayerProps({
  colors,
  sourceTable,
  layersSettings,
  t,
}: {
  colors: Theme;
  sourceTable?: string;
  layersSettings: MapState['layersSettings'];
  t?: TFunction;
}): Omit<SymbolLayer, 'id'> {
  const res: Omit<SymbolLayer, 'id'> = {
    type: 'symbol',
    minzoom: 9,
    maxzoom: 24,
    layout: {
      visibility: 'visible',
      'text-font': ['Roboto Bold'],
      'symbol-placement': 'line-center',
      'text-field': [
        'concat',
        t ? t('zone').toUpperCase() : 'zone',
        ' ',
        ['to-string', getSpeedSectionsName(layersSettings)],
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

  if (!isNil(sourceTable)) res['source-layer'] = sourceTable;

  return res;
}

export function getLPVSpeedLineBGLayerProps({
  sourceTable,
}: {
  colors?: Theme;
  sourceTable?: string;
  layersSettings?: MapState['layersSettings'];
}): Omit<LineLayer, 'id'> {
  const res: Omit<LineLayer, 'id'> = {
    type: 'line',
    minzoom: 6,
    maxzoom: 24,
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

  if (!isNil(sourceTable)) res['source-layer'] = sourceTable;

  return res;
}

export function getLPVSpeedLineLayerProps({
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
      'line-cap': ['step', ['zoom'], 'round', 15, 'square'],
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
      'line-width': 3,
      'line-offset': 0,
      'line-opacity': 1,
      'line-gap-width': 7,
      'line-dasharray': [1, 2],
    },
  };

  if (!isNil(sourceTable)) res['source-layer'] = sourceTable;

  return res;
}

export default function SNCF_LPV(props: SNCF_LPVProps) {
  const { t } = useTranslation('map-settings');
  const { layersSettings } = useSelector((state: RootState) => state.map);
  const infraID = useSelector(getInfraID);
  const { geomType, colors, layerOrder } = props;

  const speedSectionFilter = getLPVFilter(layersSettings);

  const speedValueParams = {
    ...getLPVSpeedValueLayerProps({
      t,
      colors,
      layersSettings,
      sourceTable: 'lpv',
    }),
    filter: speedSectionFilter,
  };

  const speedLineBGParams = {
    ...getLPVSpeedLineBGLayerProps({
      colors,
      layersSettings,
      sourceTable: 'lpv',
    }),
    filter: speedSectionFilter,
  };

  const speedLineParams = {
    ...getLPVSpeedLineLayerProps({
      colors,
      layersSettings,
      sourceTable: 'lpv',
    }),
    filter: speedSectionFilter,
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
