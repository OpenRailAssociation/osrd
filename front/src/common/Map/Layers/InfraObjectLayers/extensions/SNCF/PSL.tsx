import type { Geometry } from 'geojson';
import type { TFunction } from 'i18next';
import { isNil } from 'lodash';
import { useTranslation } from 'react-i18next';
import { Source } from 'react-map-gl/maplibre';
import type { LineLayerSpecification, SymbolLayerSpecification } from 'react-map-gl/maplibre';

import { MAP_URL } from 'common/Map/const';
import {
  DEFAULT_HALO_WIDTH,
  getAllowOverlap,
  getDynamicTextSize,
} from 'common/Map/Layers/commonLayers';
import type { Theme } from 'common/Map/theme';
import type { LayersSettings, MapSettings } from 'reducers/commonMap/types';
import type { OmitLayer } from 'types';

import SNCF_PSL_Signs from './PSLSigns';
import OrderedLayer from '../../../OrderedLayer';
import { getSpeedSectionsName, getFilterBySpeedSectionsTag } from '../../SpeedLimits';

type SNCF_PSLProps = {
  colors: Theme;
  layerOrder: number;
  punctualLayerOrder: number;
  infraID?: number;
  layersSettings: MapSettings['layersSettings'];
  highlightedArea?: Geometry;
};

export function getPSLSpeedValueLayerProps({
  colors,
  sourceTable,
  layersSettings,
  t,
}: {
  colors: Theme;
  sourceTable?: string;
  layersSettings: LayersSettings;
  t?: TFunction<'translation'>;
}): OmitLayer<SymbolLayerSpecification> {
  const res: OmitLayer<SymbolLayerSpecification> = {
    type: 'symbol',
    minzoom: 9,
    maxzoom: 24,
    layout: {
      visibility: 'visible',
      'text-font': ['IBMPlexSans-Bold'],
      'symbol-placement': 'line-center',
      'text-field': [
        'concat',
        t ? t('mapSettings.zone').toUpperCase() : 'zone',
        ' ',
        ['to-string', getSpeedSectionsName(layersSettings)],
        'km/h',
      ],
      'text-size': getDynamicTextSize(),
      'text-justify': 'left',
      'text-allow-overlap': getAllowOverlap(),
      'text-ignore-placement': false,
      'text-offset': [0, -1],
    },
    paint: {
      'text-color': colors.psl.text,
      'text-halo-color': colors.psl.halo,
      'text-halo-width': DEFAULT_HALO_WIDTH,
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
  layersSettings: LayersSettings;
}): OmitLayer<LineLayerSpecification> {
  const res: OmitLayer<LineLayerSpecification> = {
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
  layersSettings: LayersSettings;
}): OmitLayer<LineLayerSpecification> {
  const res: OmitLayer<LineLayerSpecification> = {
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

const SNCF_PSL = ({
  colors,
  layerOrder,
  punctualLayerOrder,
  infraID,
  layersSettings,
  highlightedArea,
}: SNCF_PSLProps) => {
  const { t } = useTranslation();
  const speedSectionFilter = getFilterBySpeedSectionsTag(layersSettings, highlightedArea);

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

  if (isNil(infraID)) return null;
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
      <SNCF_PSL_Signs colors={colors} layerOrder={punctualLayerOrder} filter={speedSectionFilter} />
    </>
  );
};

export default SNCF_PSL;
