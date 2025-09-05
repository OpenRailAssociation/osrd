import type { Geometry } from 'geojson';
import { isNil } from 'lodash';
import { Source, type SymbolLayerSpecification } from 'react-map-gl/maplibre';

import { MAP_URL } from 'common/Map/const';
import type { Theme } from 'common/Map/theme';
import type { OmitLayer } from 'types';

import { DEFAULT_HALO_WIDTH, getAllowOverlap, getDynamicTextSize } from '../commonLayers';
import OrderedLayer from '../OrderedLayer';

export function getBufferStopsLayerProps(params: {
  sourceTable?: string;
  highlightedArea?: Geometry;
  colors: Theme;
}): OmitLayer<SymbolLayerSpecification> {
  const res: OmitLayer<SymbolLayerSpecification> = {
    type: 'symbol',
    minzoom: 12,
    layout: {
      'text-field': '{extensions_sncf_kp}',
      'text-font': ['IBMPlexSansCondensed-Regular'],
      'text-size': getDynamicTextSize(),
      'text-offset': [1, 0.2],
      'icon-image': 'HEURTOIR',
      'icon-size': 0.2,
      'text-anchor': 'left',
      'icon-rotation-alignment': 'viewport',
      'icon-ignore-placement': false,
      'icon-allow-overlap': getAllowOverlap(15),
      'text-allow-overlap': getAllowOverlap(15),
    },
    filter: params.highlightedArea ? ['within', params.highlightedArea] : true,
    paint: {
      'text-color': params.colors.bufferstop.text,
      'text-halo-width': DEFAULT_HALO_WIDTH,
      'text-halo-color': params.colors.bufferstop.halo,
    },
  };

  if (typeof params.sourceTable === 'string') res['source-layer'] = params.sourceTable;
  return res;
}

type BufferStopsProps = {
  colors: Theme;
  layerOrder: number;
  infraID: number | undefined;
  highlightedArea?: Geometry;
};

const BufferStops = ({ layerOrder, infraID, highlightedArea, colors }: BufferStopsProps) => {
  if (isNil(infraID)) return null;
  return (
    <Source
      id="osrd_bufferstop_geo"
      type="vector"
      url={`${MAP_URL}/layer/buffer_stops/mvt/geo/?infra=${infraID}`}
    >
      <OrderedLayer
        {...getBufferStopsLayerProps({ sourceTable: 'buffer_stops', highlightedArea, colors })}
        id="chartis/osrd_bufferstop/geo"
        layerOrder={layerOrder}
      />
    </Source>
  );
};

export default BufferStops;
