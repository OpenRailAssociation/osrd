// GLOBAL UTILITY TYPES:
export type Point = {
  x: number;
  y: number;
};

export type RGBAColor = [number, number, number, number];

// CANVAS SPECIFIC TYPES:
export const PICKING_LAYERS = ['paths', 'overlay'] as const;
export type PickingLayerType = (typeof PICKING_LAYERS)[number];
export const LAYERS = ['background', 'graduations', 'paths', 'overlay', 'captions'] as const;
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
