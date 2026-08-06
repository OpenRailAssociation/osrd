import { type HTMLProps } from 'react';

import type { DataToPoint } from '../spaceTimeChart/lib/types';
import type { LAYERS, PICKING_LAYERS } from './consts';

export type BaseChartContextType = {
  fingerprint: string;
  theme: { background: string };
};

// GLOBAL UTILITY TYPES:
export type Point = {
  x: number;
  y: number;
};

export type Axis = 'x' | 'y';

export type RGBColor = [number, number, number];
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
  /** Opacity of the outline, e.g. the TOD halo. */
  opacity?: number;
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
  /** TOD occupancy bar height in px. */
  thickness?: number;
  /** Border drawn around the TOD occupancy bar. */
  border?: { color: string; width: number };
  /** Segments drawn on the curve stops. */
  stop?: {
    /** Thickness in px (defaults to 4). */
    thickness?: number;
    /** Opacity (defaults to 0.2). */
    opacity?: number;
    /** Halo color (defaults to the curve color). */
    color?: string;
  };
  label?: {
    background?: { color: string; opacity?: number; border?: string };
    color?: string;
    fontWeight?: number;
    opacity?: number;
  };
};

// PICKING SPECIFIC TYPES:
export type PickingElement = { type: string };
export type HoveredItem = { layer: PickingLayerType; element: PickingElement };

export type DrawingFunction<T> = (canvasContext: CanvasRenderingContext2D, stcContext: T) => void;

export type PickingDrawingFunction<T> = (
  imageData: ImageData,
  context: T & {
    registerPickingElement: (element: PickingElement) => number;
  },
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
  theme: BaseChartStyles & TimeChartStyles & SpaceChartStyles;
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

export type MouseContextType = MouseState & {
  data: DataPoint;
  hoveredItem: HoveredItem | null;
};

// MOUSE CONTEXT:
export type MouseState = {
  down?: { ctrl?: boolean; shift?: boolean };
  position: Point;
  isHover: boolean;
};

type CaptionStyle = {
  color: string;
  font: string;
  fontWeight?: string;
  fontSize?: string;
  topOffset?: number;
  textAlign?: CanvasTextAlign;
};

type LineStyle = {
  width: number;
  color: string;
  opacity?: number;
  dashArray?: number[];
};

export type BaseChartStyles = {
  background: string;
  pathsStyles: {
    fontSize: number;
    fontFamily: string;
  };
};

export type TimeChartStyles = {
  breakpoints: number[]; // in pixels/minute
  dateCaptionsStyle: CaptionStyle;
  dateCaptionsSize: number;
  timeCaptionsPriorities: number[][];
  timeCaptionsStyles: Record<number, CaptionStyle>;
  timeCaptionsSize: number;
  timeGraduationsPriorities: number[][];
  timeGraduationsStyles: Record<number, LineStyle>;
  timeRanges: number[];
};

export type SpaceChartStyles = {
  spaceGraduationsStyles: Record<number, LineStyle>;
};

export type PathLevel = 1 | 2 | 3 | 4 | 5;

// BUSINESS SPECIFIC TYPES:
export type DataPoint = {
  time: number;
  position: number;
};

export type Handler<P extends object> = (payload: P) => void;

// DATA TRANSLATION TYPES:
export type PointToData = (point: Point) => DataPoint;
