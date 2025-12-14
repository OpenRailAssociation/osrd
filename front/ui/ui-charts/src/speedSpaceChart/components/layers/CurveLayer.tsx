import React from 'react';

import cx from 'classnames';

import { type CanvasOptions, type LayerData, type Store } from '../../types';
import { drawCurve } from '../helpers/drawElements/curve';
import { useCanvas } from '../hooks';

type CurveLayerProps = {
  store: Store;
  curve: LayerData<number>[];
  canvasOptions: CanvasOptions;
};

const CurveLayer = ({ store, curve, canvasOptions }: CurveLayerProps) => {
  const { id, width, height } = canvasOptions;
  const canvas = useCanvas(drawCurve, {
    width,
    height,
    store,
    layerData: curve,
    canvasOptions,
  });

  return (
    <canvas
      id={id}
      className={cx('absolute rounded-t-xl')}
      ref={canvas}
      width={width}
      height={height}
    />
  );
};

export default CurveLayer;
