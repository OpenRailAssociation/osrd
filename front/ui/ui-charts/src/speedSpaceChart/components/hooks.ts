import { useEffect, useRef } from 'react';

import type { CanvasOptions, DrawFunctionParams, LayerData, Store } from '../types';

type DrawFunction = (params: DrawFunctionParams) => void;

type UseCanvasParams = {
  width: number;
  height: number;
  store: Store;
  layerData?: LayerData<unknown>[];
  canvasOptions?: CanvasOptions;
  setStore?: React.Dispatch<React.SetStateAction<Store>>;
};

type UseCanvas = (
  draw: DrawFunction,
  params: UseCanvasParams
) => React.RefObject<HTMLCanvasElement | null>;

export const useCanvas: UseCanvas = (
  draw,
  { width, height, store, layerData, canvasOptions, setStore }
) => {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const currentCanvas = canvas.current as HTMLCanvasElement;
    const ctx = currentCanvas.getContext('2d') as CanvasRenderingContext2D;
    draw({ ctx, width, height, store, layerData, canvasOptions, setStore });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, height, store]);

  return canvas;
};
