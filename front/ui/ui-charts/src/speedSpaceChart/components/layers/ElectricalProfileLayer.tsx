import React from 'react';

import type { Store } from '../../types';
import { drawElectricalProfile } from '../helpers/drawElements/electricalProfile';
import { useCanvas } from '../hooks';

type ElectricalProfileLayerProps = {
  width: number;
  height: number;
  store: Store;
};

const ElectricalProfileLayer = ({ width, height, store }: ElectricalProfileLayerProps) => {
  const canvas = useCanvas(drawElectricalProfile, { width, height, store });

  return (
    <canvas
      id="electrical-profile-layer"
      className="absolute"
      ref={canvas}
      width={width}
      height={height}
    />
  );
};

export default ElectricalProfileLayer;
