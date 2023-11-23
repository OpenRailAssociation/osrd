import React, { FC } from 'react';
import { useSelector } from 'react-redux';
import { Source, SymbolLayer } from 'react-map-gl/maplibre';
import { getInfraID } from 'reducers/osrdconf/selectors';
import { Theme, OmitLayer } from 'types';
import { MAP_URL } from 'common/Map/const';
import OrderedLayer from 'common/Map/Layers/OrderedLayer';
import { getLayersSettings } from 'reducers/map/selectors';

export function getBufferStopsLayerProps(params: {
  sourceTable?: string;
  editor?: boolean;
}): OmitLayer<SymbolLayer> {
  const res: OmitLayer<SymbolLayer> = {
    type: 'symbol',
    minzoom: 12,
    layout: {
      'text-field': !params.editor
        ? '{extensions_sncf_kp}'
        : [
            'format',
            ['get', 'id'],
            { 'font-scale': 1 },
            '\n',
            {},
            ['get', 'extensions_sncf_kp'],
            { 'font-scale': 0.8 },
          ],
      'text-font': ['Roboto Condensed'],
      'text-justify': 'left',
      'text-size': 10,
      'text-offset': [1, 0.2],
      'icon-image': 'HEURTOIR',
      'icon-size': 0.2,
      'text-anchor': 'left',
      'icon-rotation-alignment': 'viewport',
      'icon-ignore-placement': false,
      'icon-allow-overlap': ['step', ['zoom'], false, 15, true],
      'text-allow-overlap': ['step', ['zoom'], false, 15, true],
    },
    paint: {
      'text-color': '#333',
    },
  };

  if (typeof params.sourceTable === 'string') res['source-layer'] = params.sourceTable;
  return res;
}

interface BufferStopsProps {
  colors: Theme;
  layerOrder: number;
}

const BufferStops: FC<BufferStopsProps> = ({ layerOrder }) => {
  const infraID = useSelector(getInfraID);
  const layersSettings = useSelector(getLayersSettings);

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
    </Source>
  ) : null;
};

export default BufferStops;
