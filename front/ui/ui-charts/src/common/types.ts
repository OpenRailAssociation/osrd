import type { LAYERS, PICKING_LAYERS } from './consts';

export type BaseChartContextType = {
  fingerprint: string;
  pickingElements: PickingElement[];
  resetPickingElements: () => void;
  theme: { background: string };
};

// GLOBAL UTILITY TYPES:
export type Point = {
  x: number;
  y: number;
};

export type RGBAColor = [number, number, number, number];

// CANVAS SPECIFIC TYPES:
export type PickingLayerType = (typeof PICKING_LAYERS)[number];
export type LayerType = (typeof LAYERS)[number];

// PICKING SPECIFIC TYPES:
export type PickingElement = { type: string };
export type HoveredItem = { layer: PickingLayerType; element: PickingElement };

export type DrawingFunction<T> = (canvasContext: CanvasRenderingContext2D, stcContext: T) => void;

export type PickingDrawingFunction<T> = (
  imageData: ImageData,
  stcContext: T,
  scalingRatio: number
) => void;

export type DrawingFunctionHandler<T> = (
  arg:
    | { type: 'picking'; layer: PickingLayerType; fn: PickingDrawingFunction<T> }
    | { type: 'rendering'; layer: LayerType; fn: DrawingFunction<T> }
) => void;

export type CanvasContextType<T> = {
  register: DrawingFunctionHandler<T>;
  unregister: DrawingFunctionHandler<T>;
  captureCanvases: () => Promise<Blob>;
};

// TIME TRANSLATION TYPES:
export type TimeToPixel = (time: number) => number;
export type PixelToTime = (x: number) => number;
