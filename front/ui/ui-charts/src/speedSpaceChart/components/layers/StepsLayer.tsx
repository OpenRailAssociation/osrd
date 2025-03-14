import React from 'react';

import type { Store } from '../../types';
import { drawSteps } from '../helpers/drawElements/steps';
import { useCanvas } from '../hooks';

type StepsLayerProps = {
  width: number;
  height: number;
  store: Store;
};

const StepsLayer = ({ width, height, store }: StepsLayerProps) => {
  const canvas = useCanvas(drawSteps, { width, height, store });

  return (
    <canvas
      id="steps-layer"
      className="absolute rounded-t-xl"
      ref={canvas}
      width={width}
      height={height}
    />
  );
};

export default StepsLayer;
