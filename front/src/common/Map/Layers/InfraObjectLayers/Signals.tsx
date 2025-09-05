import type { Geometry } from 'geojson';
import { isNil } from 'lodash';
import { Source, type MapRef } from 'react-map-gl/maplibre';

import { MAP_URL } from 'common/Map/const';
import type { Theme } from 'common/Map/theme';

import { getPointLayerProps, getSignalLayerProps } from './geoSignalsLayers';
import getKPLabelLayerProps from './getKPLabelLayerProps';
import getMastLayerProps from './getMastLayerProps';
import OrderedLayer from '../OrderedLayer';
import { type SignalContext } from '../types';

type PlatformProps = {
  colors: Theme;
  sourceTable: string;
  hovered?: { id: string; layer: string };
  mapRef?: React.RefObject<MapRef>;
  layerOrder: number;
  infraID: number | undefined;
  highlightedArea?: Geometry;
};

const Signals = ({ colors, sourceTable, layerOrder, infraID, highlightedArea }: PlatformProps) => {
  const context: SignalContext = {
    colors,
    sourceTable,
    sidePropertyName: 'extensions_sncf_side',
    minzoom: 12,
  };

  if (isNil(infraID)) return null;
  return (
    <Source
      promoteId="id"
      type="vector"
      url={`${MAP_URL}/layer/${sourceTable}/mvt/geo/?infra=${infraID}`}
    >
      <OrderedLayer
        {...getMastLayerProps({ ...context, highlightedArea })}
        layerOrder={layerOrder}
      />
      <OrderedLayer
        {...getPointLayerProps({ ...context, highlightedArea })}
        layerOrder={layerOrder}
      />
      <OrderedLayer
        {...getKPLabelLayerProps({
          bottomOffset: 6.5,
          colors,
          PKFieldName: 'extensions_sncf_kp',
          minzoom: 12,
          isSignalisation: true,
          sourceTable,
          highlightedArea,
        })}
        layerOrder={layerOrder}
      />
      <OrderedLayer
        {...getSignalLayerProps({ ...context, highlightedArea })}
        layerOrder={layerOrder}
      />
    </Source>
  );
};

export default Signals;
