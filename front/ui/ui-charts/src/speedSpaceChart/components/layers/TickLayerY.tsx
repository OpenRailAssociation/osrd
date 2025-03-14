import React from 'react';

import type { Store } from '../../types';
import { drawAxisY } from '../helpers/drawElements/axisY';
import { useCanvas } from '../hooks';

type TickLayerYProps = {
  width: number;
  height: number;
  store: Store;
};

const AxisLayerY = ({ width, height, store }: TickLayerYProps) => {
  const canvas = useCanvas(drawAxisY, { width, height, store });

  return (
    <canvas
      id="tick-layer-y"
      className="absolute rounded-t-xl"
      ref={canvas}
      width={width}
      height={height}
    />
  );
};

export default AxisLayerY;
