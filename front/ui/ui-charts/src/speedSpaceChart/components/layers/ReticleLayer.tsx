import React, { useEffect, useRef, useState } from 'react';

import type { TrainDetails, Store } from '../../types';
import DetailsBox from '../common/DetailsBox';
import { MARGINS } from '../const';
import { drawCursor } from '../helpers/drawElements/reticle';
import { clearCanvas } from '../utils';

type ReticleLayerProps = {
  width: number;
  internalHeight: number;
  store: Store;
};

const ReticleLayer = ({ width, internalHeight: height, store }: ReticleLayerProps) => {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [trainDetails, setTrainDetails] = useState<TrainDetails | null>(null);

  useEffect(() => {
    const currentCanvas = canvas.current as HTMLCanvasElement;
    const ctx = currentCanvas.getContext('2d') as CanvasRenderingContext2D;
    // The tooltip shouldn't be displayed when hovering on the linear layers
    if (store.cursor.y && store.cursor.y < height - MARGINS.MARGIN_TOP - MARGINS.MARGIN_BOTTOM) {
      const detailsBox = drawCursor({ ctx, width, height, store });
      setTrainDetails(detailsBox || null);
    } else {
      clearCanvas(ctx, width, height);
      setTrainDetails(null);
    }
  }, [width, height, store]);

  return (
    <>
      <canvas id="cursor-layer" className="absolute" ref={canvas} width={width} height={height} />
      {trainDetails && <DetailsBox width={width} height={height} store={store} {...trainDetails} />}
    </>
  );
};

export default ReticleLayer;
