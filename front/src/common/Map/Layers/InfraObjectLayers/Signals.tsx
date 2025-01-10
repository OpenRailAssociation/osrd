import { isNil } from 'lodash';
import { Source, type MapRef } from 'react-map-gl/maplibre';
import { useSelector } from 'react-redux';

import { MAP_URL } from 'common/Map/const';
import getMastLayerProps from 'common/Map/Layers/mastLayerProps';
import OrderedLayer from 'common/Map/Layers/OrderedLayer';
import type { SignalContext } from 'common/Map/Layers/types';
import { getLayersSettings, getMapStyle } from 'reducers/map/selectors';
import type { Theme } from 'types';

import { getPointLayerProps, getSignalLayerProps } from './geoSignalsLayers';
import getKPLabelLayerProps from './getKPLabelLayerProps';

interface PlatformProps {
  colors: Theme;
  sourceTable: string;
  hovered?: { id: string; layer: string };
  mapRef?: React.RefObject<MapRef>;
  layerOrder: number;
  infraID: number | undefined;
}

const Signals = ({ colors, sourceTable, layerOrder, infraID }: PlatformProps) => {
  const mapStyle = useSelector(getMapStyle);
  const layersSettings = useSelector(getLayersSettings);

  const prefix = mapStyle === 'blueprint' ? 'SCHB ' : '';

  const context: SignalContext = {
    prefix,
    colors,
    sourceTable,
    sidePropertyName: 'extensions_sncf_side',
    minzoom: 12,
  };

  if (!layersSettings.signals || isNil(infraID)) return null;
  return (
    <Source
      promoteId="id"
      type="vector"
      url={`${MAP_URL}/layer/${sourceTable}/mvt/geo/?infra=${infraID}`}
    >
      <OrderedLayer {...getMastLayerProps(context)} layerOrder={layerOrder} />
      <OrderedLayer {...getPointLayerProps(context)} layerOrder={layerOrder} />
      <OrderedLayer
        {...getKPLabelLayerProps({
          bottomOffset: 6.5,
          colors,
          PKFieldName: 'extensions_sncf_kp',
          minzoom: 12,
          isSignalisation: true,
          sourceTable,
        })}
        layerOrder={layerOrder}
      />
      <OrderedLayer {...getSignalLayerProps(context)} layerOrder={layerOrder} />
    </Source>
  );
};

export default Signals;
