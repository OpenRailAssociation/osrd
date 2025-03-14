import React from 'react';

import type { Store } from '../../types';
import { drawSpeedLimits } from '../helpers/drawElements/speedLimits';
import { useCanvas } from '../hooks';

type SpeedLimitsLayerProps = {
  width: number;
  height: number;
  store: Store;
};

const SpeedLimitsLayer = ({ width, height, store }: SpeedLimitsLayerProps) => {
  const canvas = useCanvas(drawSpeedLimits, { width, height, store });

  return (
    <canvas
      id="speed-limits-layer"
      className="absolute rounded-t-xl"
      ref={canvas}
      width={width}
      height={height}
    />
  );
};

export default SpeedLimitsLayer;
