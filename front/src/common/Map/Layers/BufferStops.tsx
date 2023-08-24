import React, { FC } from 'react';
import { useSelector } from 'react-redux';
import { Source, SymbolLayer } from 'react-map-gl';
import { getInfraID } from 'reducers/osrdconf/selectors';
import { RootState } from 'reducers';
import { Theme } from 'types';
import { MAP_URL } from 'common/Map/const';

import OrderedLayer from 'common/Map/Layers/OrderedLayer';

export function getBufferStopsLayerProps(params: {
  sourceTable?: string;
}): Omit<SymbolLayer, 'id'> {
  const res: Omit<SymbolLayer, 'id'> = {
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
      visibility: 'visible',
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
  geomType: string;
  layerOrder: number;
}

const BufferStops: FC<BufferStopsProps> = ({ geomType, layerOrder }) => {
  const infraID = useSelector(getInfraID);
  const { layersSettings } = useSelector((state: RootState) => state.map);

  return layersSettings.bufferstops ? (
    <Source
      id={`osrd_bufferstoplayer_${geomType}`}
      type="vector"
      url={`${MAP_URL}/layer/buffer_stops/mvt/${geomType}/?infra=${infraID}`}
    >
      <OrderedLayer
        {...getBufferStopsLayerProps({ sourceTable: 'buffer_stops' })}
        id={`chartis/osrd_bufferstoplayer/${geomType}`}
        layerOrder={layerOrder}
      />
    </Source>
  ) : null;
};

export default BufferStops;
