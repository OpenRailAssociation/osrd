import React from 'react';

import type { Store } from '../../types';
import { drawFrame } from '../helpers/frontFrame';
import { useCanvas } from '../hooks';

type FrontInteractivityLayerProps = {
  width: number;
  height: number;
  store: Store;
  setStore: React.Dispatch<React.SetStateAction<Store>>;
};

const FrontInteractivityLayer = ({
  width,
  height,
  store,
  setStore,
}: FrontInteractivityLayerProps) => {
  const canvas = useCanvas(drawFrame, { width, height, store, setStore });

  return (
    <canvas
      id="front-interactivity-layer"
      className="absolute"
      ref={canvas}
      width={width}
      height={height}
    />
  );
};

export default FrontInteractivityLayer;
