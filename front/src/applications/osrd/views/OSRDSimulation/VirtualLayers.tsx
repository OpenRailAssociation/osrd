import React from 'react';
import { Layer } from 'react-map-gl';
import { range } from 'lodash';

export const VIRTUAL_LAYERS = 7;

export default function VirtualLayers() {
  const layers = range(0, VIRTUAL_LAYERS)
    .reverse()
    .map((n) => {
      const before =
        n < VIRTUAL_LAYERS
          ? {
              beforeId: `virtual-layer-${n + 1}`,
            }
          : {};
      return (
        <Layer
          id={`virtual-layer-${n}`}
          type="background"
          layout={{ visibility: 'none' }}
          paint={{}}
          {...before}
        />
      );
    });
  return <>{layers}</>;
}
