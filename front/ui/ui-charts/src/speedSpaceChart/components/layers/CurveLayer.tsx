import React from 'react';

import cx from 'classnames';

import type { Store } from '../../types';
import { drawCurve } from '../helpers/drawElements/curve';
import { useCanvas } from '../hooks';

type CurveLayerProps = {
  width: number;
  height: number;
  store: Store;
};

const CurveLayer = ({ width, height, store }: CurveLayerProps) => {
  const canvas = useCanvas(drawCurve, {
    width,
    height,
    store,
  });

  return (
    <canvas
      id="curve-layer"
      className={cx('absolute rounded-t-xl', { 'bg-white-25': !store.layersDisplay.declivities })}
      ref={canvas}
      width={width}
      height={height}
    />
  );
};

export default CurveLayer;
