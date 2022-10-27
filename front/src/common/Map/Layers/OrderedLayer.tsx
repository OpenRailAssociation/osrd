import React from 'react';
import { Layer, LayerProps } from 'react-map-gl';

type OrderedLayerProps = LayerProps & {
  layerOrder: number;
};

export default function OrderedLayer(props: OrderedLayerProps) {
  const { layerOrder, ...restOfLayerProps } = props;

  return <Layer beforeId={`virtual-layer-${layerOrder + 1}`} {...restOfLayerProps} />;
}
