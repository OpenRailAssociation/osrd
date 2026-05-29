import { type HTMLProps } from 'react';

import type { PathLevel, SpaceTimeChartTheme } from '../spaceTimeChart';
import type { DataPoint, Handler, PointToData, DataToPoint } from '../spaceTimeChart/lib/types';
import type { LAYERS, PICKING_LAYERS } from './consts';

export type BaseChartContextType = {
  fingerprint: string;
  pickingElements: PickingElement[];
  resetPickingElements: () => void;
  registerPickingElement: (element: PickingElement) => number;
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

export type CurveOutline = {
  /** Offset compared to the curve */
  offset: number;
  /** Color of the outline */
  color: string;
  /** Thickness of the outline */
  width?: number;
  /** Won't be used most of the time, color will be used */
  backgroundColor?: string;
};

/**
 * Visual style of a curve, computed by the shared curve-style helper
 * and used by STD (PathLayer) and TOD (OccupancyBlockLayer).
 *
 * TODO: reuse this type in PathLayerProps when integrating drag and drop in STD/TOD.
 */
export type CurveStyle = {
  color: string;
  opacity: number;
  level?: PathLevel;
  outline?: CurveOutline;
  label?: {
    border?: { color: string; width: number };
    fontWeight?: number;
    background: { color: string; opacity?: number };
    color: string;
  };
};

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

// TODO: GENERALIZE THIS TYPE FOR OTHER CHARTS
type BaseTimeChartContextType = BaseChartContextType & {
  width: number;
  height: number;

  // Time Scales:
  timePixelOffset: number;
  timeOrigin: number;
  timeScale: number;
  yPixelOffset: number;

  // Translation helpers:
  getTimePixel: TimeToPixel;
  getTime: PixelToTime;
  getPoint: DataToPoint;
  getData: PointToData;

  // Full theme:
  // TODO: create a more generic ChartTheme
  theme: SpaceTimeChartTheme;
};

export type ChartOptions = {
  captionSize?: number;
  enableSnapping?: boolean;
  hideDates?: boolean;
  hideGrid?: boolean;
  hidePathsLabels?: boolean;
  hideTimeCaptions?: boolean;
  showTicks?: boolean;
  swapAxis?: boolean;
};

export type TimeChartContextType = BaseTimeChartContextType & ChartOptions;

export type ChartEventHandlers<T> = {
  // Event handlers:
  onPan?: Handler<{
    isPanning: boolean;
    initialPosition: Point;
    position: Point;
    initialData: DataPoint;
    data: DataPoint;
    context: T;
  }>;
  onZoom?: Handler<{
    delta: number;
    position: Point;
    event: WheelEvent;
    context: T;
  }>;
  onClick?: Handler<{
    position: Point;
    data: DataPoint;
    event: MouseEvent;
    hoveredItem: HoveredItem | null;
    context: T;
  }>;
  onMouseMove?: Handler<{
    position: Point;
    data: DataPoint;
    isHover: boolean;
    hoveredItem: HoveredItem | null;
    context: T;
  }>;
  onHoveredChildUpdate?: Handler<{ item: HoveredItem | null; context: T }>;
} & Omit<HTMLProps<HTMLDivElement>, 'onClick' | 'onMouseMove'>;
