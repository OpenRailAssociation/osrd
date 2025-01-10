import { isNil } from 'lodash';
import { Source, type SymbolLayer } from 'react-map-gl/maplibre';
import { useSelector } from 'react-redux';

import { MAP_URL } from 'common/Map/const';
import OrderedLayer from 'common/Map/Layers/OrderedLayer';
import { getLayersSettings } from 'reducers/map/selectors';
import type { Theme, OmitLayer } from 'types';

export function getBufferStopsLayerProps(params: { sourceTable?: string }): OmitLayer<SymbolLayer> {
  const res: OmitLayer<SymbolLayer> = {
    type: 'symbol',
    minzoom: 12,
    layout: {
      'text-field': '{extensions_sncf_kp}',
      'text-font': ['Roboto Condensed'],
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
  infraID: number | undefined;
}

const BufferStops = ({ layerOrder, infraID }: BufferStopsProps) => {
  const layersSettings = useSelector(getLayersSettings);

  if (!layersSettings.bufferstops || isNil(infraID)) return null;
  return (
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
  );
};

export default BufferStops;
