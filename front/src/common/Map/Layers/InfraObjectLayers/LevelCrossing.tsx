import type { Geometry } from 'geojson';
import { isNil, pick } from 'lodash';
import { Source, type SymbolLayerSpecification } from 'react-map-gl/maplibre';

import { MAP_URL } from 'common/Map/const';
import type { Theme } from 'common/Map/theme';
import type { OmitLayer } from 'types';

import { DEFAULT_HALO_WIDTH, getAllowOverlap, getDynamicTextSize } from '../commonLayers';
import OrderedLayer from '../OrderedLayer';

export function getLevelCrossingsLayerProps(params: {
  sourceTable: string;
  highlightedArea?: Geometry;
  colors: Theme;
  icon: 'LEVEL_CROSSING' | 'LEVEL_CROSSING_GROUP';
  minzoom?: number;
  maxzoom?: number;
}): OmitLayer<SymbolLayerSpecification> {
  const res: OmitLayer<SymbolLayerSpecification> = {
    type: 'symbol',
    layout: {
      'text-field': '{extensions_sncf_kp}',
      'text-font': ['IBMPlexSansCondensed-Regular'],
      'text-size': getDynamicTextSize(),
      'text-offset': [1, 0.2],
      'icon-image': params.icon,
      'icon-size': 1,
      'text-anchor': 'left',
      'icon-rotation-alignment': 'viewport',
      'icon-ignore-placement': false,
      'icon-allow-overlap': getAllowOverlap(15),
      'text-allow-overlap': getAllowOverlap(15),
    },
    filter: params.highlightedArea ? ['within', params.highlightedArea] : true,
    paint: {
      'text-color': params.colors.levelcrossings.text,
      'text-halo-width': DEFAULT_HALO_WIDTH,
      'text-halo-color': params.colors.levelcrossings.halo,
    },
    'source-layer': params.sourceTable,
    ...pick(params, ['minzoom', 'maxzoom']),
  };
  return res;
}

type LevelCrossingsProps = {
  colors: Theme;
  layerOrder: number;
  infraID: number | undefined;
  highlightedArea?: Geometry;
};

const LevelCrossingsLayer = ({
  layerOrder,
  infraID,
  highlightedArea,
  colors,
}: LevelCrossingsProps) => {
  if (isNil(infraID)) return null;
  const zoomLevelForGroup = 15;
  return (
    <Source
      id="osrd_levelcrossing_geo"
      type="vector"
      url={`${MAP_URL}/layer/level_crossings/mvt/geo/?infra=${infraID}`}
    >
      <OrderedLayer
        {...getLevelCrossingsLayerProps({
          sourceTable: 'level_crossings',
          icon: 'LEVEL_CROSSING_GROUP',
          minzoom: 0,
          maxzoom: zoomLevelForGroup,
          highlightedArea,
          colors,
        })}
        id="chartis/osrd_levelcrossing/geo-group"
        layerOrder={layerOrder}
      />
      <OrderedLayer
        {...getLevelCrossingsLayerProps({
          sourceTable: 'level_crossings',
          icon: 'LEVEL_CROSSING',
          minzoom: zoomLevelForGroup,
          highlightedArea,
          colors,
        })}
        id="chartis/osrd_levelcrossing/geo"
        layerOrder={layerOrder}
      />
    </Source>
  );
};

export default LevelCrossingsLayer;
