import React from 'react';
import { Layer, LayerProps } from 'react-map-gl';
import { isNumber } from 'lodash';

type OrderedLayerProps = LayerProps & {
  layerOrder?: number;
};

export default function OrderedLayer(props: OrderedLayerProps) {
  const { layerOrder, ...restOfLayerProps } = props;
  const layerProps = {
    ...restOfLayerProps,
    ...(isNumber(layerOrder) && { beforeId: `virtual-layer-${layerOrder}` }),
  };
  return <Layer {...layerProps} />;
}
