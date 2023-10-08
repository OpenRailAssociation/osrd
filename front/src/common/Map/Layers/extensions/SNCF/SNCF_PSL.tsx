/* eslint-disable react/jsx-pascal-case */
import React from 'react';
import { useSelector } from 'react-redux';
import { RootState } from 'reducers';
import { LineLayer, SymbolLayer, Source } from 'react-map-gl/maplibre';
import { isNil } from 'lodash';
import { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { FilterSpecification } from 'maplibre-gl';

import { MAP_URL } from 'common/Map/const';
import OrderedLayer from 'common/Map/Layers/OrderedLayer';
import { getInfraID } from 'reducers/osrdconf/selectors';
import { MapState } from 'reducers/map';
import { getSpeedSectionsTag, getSpeedSectionsName } from '../../SpeedLimits';
import { Theme, OmitLayer } from '../../../../../types';
import SNCF_PSL_Signs from './SNCF_PSL_SIGNS';

interface SNCF_PSLProps {
  colors: Theme;
  layerOrder?: number;
}

export function getPSLFilter(layersSettings: MapState['layersSettings']): FilterSpecification {
  return ['any', ['has', 'speed_limit'], ['has', getSpeedSectionsTag(layersSettings)]];
}

export function getPSLSpeedValueLayerProps({
  colors,
  sourceTable,
  layersSettings,
  t,
}: {
  colors: Theme;
  sourceTable?: string;
  layersSettings: MapState['layersSettings'];
  t?: TFunction;
}): OmitLayer<SymbolLayer> {
  const res: OmitLayer<SymbolLayer> = {
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
      'text-color': colors.psl.text,
      'text-halo-color': colors.psl.halo,
      'text-halo-width': 1,
      'text-opacity': 1,
    },
  };

  if (!isNil(sourceTable)) res['source-layer'] = sourceTable;

  return res;
}

export function getPSLSpeedLineBGLayerProps({
  sourceTable,
}: {
  colors?: Theme;
  sourceTable?: string;
  layersSettings?: MapState['layersSettings'];
}): OmitLayer<LineLayer> {
  const res: OmitLayer<LineLayer> = {
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

export function getPSLSpeedLineLayerProps({
  sourceTable,
  layersSettings,
}: {
  colors?: Theme;
  sourceTable?: string;
  layersSettings: MapState['layersSettings'];
}): OmitLayer<LineLayer> {
  const res: OmitLayer<LineLayer> = {
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

export default function SNCF_PSL(props: SNCF_PSLProps) {
  const { t } = useTranslation('map-settings');
  const { layersSettings } = useSelector((state: RootState) => state.map);
  const infraID = useSelector(getInfraID);
  const { colors, layerOrder } = props;

  const speedSectionFilter = getPSLFilter(layersSettings);

  const speedValueParams = {
    ...getPSLSpeedValueLayerProps({
      t,
      colors,
      layersSettings,
      sourceTable: 'psl',
    }),
    filter: speedSectionFilter,
  };

  const speedLineBGParams = {
    ...getPSLSpeedLineBGLayerProps({
      colors,
      layersSettings,
      sourceTable: 'psl',
    }),
    filter: speedSectionFilter,
  };

  const speedLineParams = {
    ...getPSLSpeedLineLayerProps({
      colors,
      layersSettings,
      sourceTable: 'psl',
    }),
    filter: speedSectionFilter,
  };

  if (layersSettings.sncf_psl) {
    return (
      <>
        <Source
          id="osrd_sncf_psl_geo"
          type="vector"
          url={`${MAP_URL}/layer/psl/mvt/geo/?infra=${infraID}`}
        >
          <OrderedLayer
            {...speedValueParams}
            id="chartis/osrd_sncf_psl_value/geo"
            layerOrder={layerOrder}
          />
          <OrderedLayer
            {...speedLineBGParams}
            id="chartis/osrd_sncf_psl_colors_bg/geo"
            layerOrder={layerOrder}
          />
          <OrderedLayer
            {...speedLineParams}
            id="chartis/osrd_sncf_psl_colors/geo"
            layerOrder={layerOrder}
          />
        </Source>
        <SNCF_PSL_Signs layerOrder={layerOrder} />
      </>
    );
  }
  return null;
}
