import React from 'react';
import { Layer, LayerProps, MapContext } from 'react-map-gl';
import { Map as MapboxType } from 'mapbox-gl';
import { isNumber } from 'lodash';

type OrderedLayerProps = LayerProps & {
  layerOrder?: number;
};

export default function OrderedLayer(props: OrderedLayerProps) {
  const { map } = React.useContext(MapContext);
  const { layerOrder, ...restOfLayerProps } = props;

  const layerProps = { ...restOfLayerProps };
  if (isNumber(layerOrder) && (map as MapboxType).getLayer(`virtual-layer-${layerOrder}`)) {
    layerProps.beforeId = `virtual-layer-${layerOrder}`;
  }
  return <Layer {...layerProps} />;
}
