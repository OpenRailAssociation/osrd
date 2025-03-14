import React from 'react';

import type { Store } from '../../types';
import { drawTickX } from '../helpers/drawElements/tickX';
import { useCanvas } from '../hooks';

type TickLayerXProps = {
  width: number;
  height: number;
  store: Store;
};

const TickLayerX = ({ width, height, store }: TickLayerXProps) => {
  const canvas = useCanvas(drawTickX, { width, height, store });

  return (
    <canvas
      id="tick-layer-x"
      className="absolute rounded-t-xl"
      ref={canvas}
      width={width}
      height={height}
    />
  );
};

export default TickLayerX;
