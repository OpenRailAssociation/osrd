import { range } from 'lodash';
import { Layer } from 'react-map-gl/maplibre';

import { LAYER_GROUPS_ORDER } from 'config/layerOrder';

export const VIRTUAL_LAYERS = Object.getOwnPropertySymbols(LAYER_GROUPS_ORDER).length;

export default function VirtualLayers() {
  const layers = range(0, VIRTUAL_LAYERS)
    .reverse()
    .map((n) => {
      const before =
        n < VIRTUAL_LAYERS - 1
          ? {
              beforeId: `virtual-layer-${n + 1}`,
            }
          : {};
      const id = `virtual-layer-${n}`;
      return (
        <Layer
          key={id}
          id={id}
          type="background"
          layout={{ visibility: 'none' }}
          paint={{}}
          {...before}
        />
      );
    });
  return <div>{layers}</div>;
}
