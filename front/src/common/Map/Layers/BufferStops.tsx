import React, { FC } from 'react';
import { useSelector } from 'react-redux';
import { Source, SymbolLayer } from 'react-map-gl/maplibre';
import { getInfraID } from 'reducers/osrdconf/selectors';
import { RootState } from 'reducers';
import { Theme, OmitLayer } from 'types';
import { MAP_URL } from 'common/Map/const';
import OrderedLayer from 'common/Map/Layers/OrderedLayer';
import configKPLabelLayer from './configKPLabelLayer';

export function getBufferStopsLayerProps(params: { sourceTable?: string }): OmitLayer<SymbolLayer> {
  const res: OmitLayer<SymbolLayer> = {
    type: 'symbol',
    minzoom: 12,
    layout: {
      'text-field': ['slice', ['get', 'id'], 11],
      'text-font': ['Roboto Condensed'],
      'text-size': 10,
      'text-offset': [0, 1.2],
      'icon-image': 'HEURTOIR',
      'icon-size': 0.2,
      'text-anchor': 'center',
      'icon-rotation-alignment': 'viewport',
      'icon-allow-overlap': false,
      'icon-ignore-placement': false,
      'text-allow-overlap': false,
    },
    paint: {
      'text-color': '#555',
      'text-halo-width': 2,
      'text-halo-color': 'rgba(255,255,255,0.75)',
      'text-halo-blur': 1,
    },
  };

  if (typeof params.sourceTable === 'string') res['source-layer'] = params.sourceTable;
  return res;
}

interface BufferStopsProps {
  colors: Theme;
  layerOrder: number;
}

const BufferStops: FC<BufferStopsProps> = ({ colors, layerOrder }) => {
  const infraID = useSelector(getInfraID);
  const { layersSettings } = useSelector((state: RootState) => state.map);

  return layersSettings.bufferstops ? (
    <Source
      id="osrd_bufferstop_geo"
      type="vector"
      url={`${MAP_URL}/layer/buffer_stops/mvt/geo/?infra=${infraID}`}
    >
      <OrderedLayer
        {...getBufferStopsLayerProps({ sourceTable: 'buffer_stops' })}
        id="chartis/osrd_bufferstop/geo"
        layerOrder={layerOrder}
      />
      <OrderedLayer
        {...configKPLabelLayer({
          colors,
          fieldName: 'extensions_sncf_kp',
          minzoom: 12,
          sourceLayer: 'buffer_stops',
        })}
        id="chartis/osrd_bufferstop_kp/geo"
        layerOrder={layerOrder}
      />
    </Source>
  ) : null;
};

export default BufferStops;
