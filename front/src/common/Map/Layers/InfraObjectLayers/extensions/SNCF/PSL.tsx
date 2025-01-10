/* eslint-disable react/jsx-pascal-case */
import type { TFunction } from 'i18next';
import { isNil } from 'lodash';
import { useTranslation } from 'react-i18next';
import { Source } from 'react-map-gl/maplibre';
import type { LineLayer, SymbolLayer } from 'react-map-gl/maplibre';
import { useSelector } from 'react-redux';

import { MAP_URL } from 'common/Map/const';
import {
  getSpeedSectionsName,
  getFilterBySpeedSectionsTag,
} from 'common/Map/Layers/InfraObjectLayers/SpeedLimits';
import OrderedLayer from 'common/Map/Layers/OrderedLayer';
import type { RootState } from 'reducers';
import type { MapState } from 'reducers/map';
import type { Theme, OmitLayer } from 'types';

import SNCF_PSL_Signs from './PSLSigns';

interface SNCF_PSLProps {
  colors: Theme;
  layerOrder?: number;
  infraID?: number | undefined;
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
  colors,
  sourceTable,
}: {
  colors: Theme;
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
      'line-color': colors.psl.color,
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

const SNCF_PSL = ({ colors, layerOrder, infraID }: SNCF_PSLProps) => {
  const { t } = useTranslation('map-settings');
  const { layersSettings } = useSelector((state: RootState) => state.map);

  const speedSectionFilter = getFilterBySpeedSectionsTag(layersSettings);

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

  if (!layersSettings.sncf_psl || isNil(infraID)) return null;
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
      <SNCF_PSL_Signs colors={colors} layerOrder={layerOrder} />
    </>
  );
};

export default SNCF_PSL;
