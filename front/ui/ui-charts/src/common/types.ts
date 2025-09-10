import type { SpaceTimeChartContextType } from '../spaceTimeChart/lib/types';

// CANVAS SPECIFIC TYPES:
export const PICKING_LAYERS = ['paths', 'overlay'] as const;
export type PickingLayerType = (typeof PICKING_LAYERS)[number];
export const LAYERS = ['background', 'graduations', 'paths', 'overlay', 'captions'] as const;
export type LayerType = (typeof LAYERS)[number];

// PICKING SPECIFIC TYPES:
export type PickingElement = { type: string };
export type HoveredItem = { layer: PickingLayerType; element: PickingElement };

export type DrawingFunction = (
  canvasContext: CanvasRenderingContext2D,
  stcContext: SpaceTimeChartContextType
) => void;

export type PickingDrawingFunction = (
  imageData: ImageData,
  stcContext: SpaceTimeChartContextType,
  scalingRatio: number
) => void;

export type DrawingFunctionHandler = (
  arg:
    | { type: 'picking'; layer: PickingLayerType; fn: PickingDrawingFunction }
    | { type: 'rendering'; layer: LayerType; fn: DrawingFunction }
) => void;

export type CanvasContextType = {
  register: DrawingFunctionHandler;
  unregister: DrawingFunctionHandler;
  captureCanvases: () => Promise<Blob>;
};
