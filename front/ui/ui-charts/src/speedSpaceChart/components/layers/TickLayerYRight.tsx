import React from 'react';

import type { Store } from '../../types';
import { drawTickYRight } from '../helpers/drawElements/tickYRight';
import { useCanvas } from '../hooks';

type TickLayerYRightProps = {
  width: number;
  height: number;
  store: Store;
};

const TickLayerYRight = ({ width, height, store }: TickLayerYRightProps) => {
  const canvas = useCanvas(drawTickYRight, { width, height, store });

  return (
    <canvas
      id="tick-layer-y-right"
      className="absolute rounded-t-xl"
      ref={canvas}
      width={width}
      height={height}
    />
  );
};

export default TickLayerYRight;
