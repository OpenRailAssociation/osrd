import { type HTMLProps, type ReactNode } from 'react';

// GLOBAL UTILITY TYPES:
export type Point = {
  x: number;
  y: number;
};

export type Handler<P extends object> = (payload: P) => void;

export type RGBAColor = [number, number, number, number];
export type RGBColor = [number, number, number];

// TIME AND SPACE SCALE UTILITY TYPES:
export type SpaceScale = {
  // End point (in meters):
  to: number;
} & (
  | {
      // Coefficient (in meters/px):
      coefficient: number;
    }
  | {
      // Size (in px):
      size: number;
    }
);

export type BinaryTreeNode<T> =
  | T
  | {
      // "limit", "from" and "to" in meters:
      limit: number;
      from: number;
      to: number;
      // "limit", "from" and "to" in screen pixels:
      pixelFrom: number;
      pixelTo: number;
      pixelLimit: number;
      // children:
      left: BinaryTreeNode<T>;
      right: BinaryTreeNode<T>;
    };

export type NormalizedScale = {
  coefficient: number;
  // "from" and "to" in meters:
  from: number;
  to: number;
  // "from" and "to" in screen pixels:
  pixelFrom: number;
  pixelTo: number;
  // siblings:
  previous?: NormalizedScale;
  next?: NormalizedScale;
};

export type NormalizedScaleTree = BinaryTreeNode<NormalizedScale>;

// BUSINESS SPECIFIC TYPES:
export type DataPoint = {
  time: number;
  position: number;
};

export type PathEnd = 'stop' | 'out';
export const DEFAULT_PATH_END = 'stop';
export type PathData = {
  id: string;
  label: string;
  points: DataPoint[];
  fromEnd?: PathEnd;
  toEnd?: PathEnd;
};

export type OperationalPoint = {
  id: string;
  position: number;
  label?: string;
  importanceLevel?: number; // Lower is better. If null, the point won't be displayed.
};

export type Axis = 'x' | 'y';

export type Direction = 'forward' | 'backward' | 'still';

// DATA TRANSLATION TYPES:
export type TimeToPixel = (time: number) => number;
export type SpaceToPixel = (position: number, fromEnd?: boolean) => number;
export type PixelToTime = (x: number) => number;
export type PixelToSpace = (y: number) => number;
export type PointToData = (point: Point) => DataPoint;
export type DataToPoint = (data: DataPoint) => Point;

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

// MOUSE CONTEXT:
export type MouseState = {
  down?: { ctrl?: boolean; shift?: boolean };
  position: Point;
  isHover: boolean;
};

export type MouseContextType = MouseState & {
  data: DataPoint;
  hoveredItem: HoveredItem | null;
};

export type LineStyle = {
  width: number;
  color: string;
  opacity?: number;
  dashArray?: number[];
};

export type CaptionStyle = {
  color: string;
  font: string;
  fontWeight?: string;
  fontSize?: string;
  topOffset?: number;
  textAlign?: CanvasTextAlign;
};

// STYLES:
export type SpaceTimeChartTheme = {
  background: string;
  breakpoints: number[]; // in pixels/minute
  timeRanges: number[];
  pathsStyles: {
    fontSize: number;
    fontFamily: string;
  };
  spaceGraduationsStyles: Record<number, LineStyle>;
  timeCaptionsPriorities: number[][];
  timeCaptionsStyles: Record<number, CaptionStyle>;
  timeCaptionsSize: number;
  timeGraduationsPriorities: number[][];
  timeGraduationsStyles: Record<number, LineStyle>;
  dateCaptionsStyle: CaptionStyle;
  dateCaptionsSize: number;
};

// CORE COMPONENT MAIN TYPES:
export type SpaceTimeChartProps = {
  children?: ReactNode | ReactNode[];

  // This allows giving the SpaceTimeChart two different set of children
  additionalChildren?: ReactNode | ReactNode[];

  operationalPoints: OperationalPoint[];

  // The space origin (i.e. the space value for the most top point)
  spaceOrigin: number;
  // The space scales:
  spaceScales: SpaceScale[];

  // The time origin (i.e. the time value for the most left point)
  timeOrigin: number;
  // The timescale (in ms/px)
  timeScale: number;

  // In addition to the time and space origins, it is possible to add offsets (in pixels)
  xOffset?: number;
  yOffset?: number;

  // If true, the time and space axis are swapped:
  swapAxis?: boolean;

  // If true, the registered position will snap to the closest item if any:
  enableSnapping?: boolean;

  // Additional options to show/hide context information:
  hideTimeCaptions?: boolean;
  hideGrid?: boolean;
  hidePathsLabels?: boolean;
  hideDates?: boolean;
  showTicks?: boolean;

  // Custom styles:
  theme?: Partial<SpaceTimeChartTheme>;

  // Event handlers:
  onPan?: Handler<{
    isPanning: boolean;
    initialPosition: Point;
    position: Point;
    initialData: DataPoint;
    data: DataPoint;
    context: SpaceTimeChartContextType;
  }>;
  onZoom?: Handler<{
    delta: number;
    position: Point;
    event: WheelEvent;
    context: SpaceTimeChartContextType;
  }>;
  onClick?: Handler<{
    position: Point;
    data: DataPoint;
    event: MouseEvent;
    hoveredItem: HoveredItem | null;
    context: SpaceTimeChartContextType;
  }>;
  onMouseMove?: Handler<{
    position: Point;
    data: DataPoint;
    isHover: boolean;
    hoveredItem: HoveredItem | null;
    context: SpaceTimeChartContextType;
  }>;
  onHoveredChildUpdate?: Handler<{ item: HoveredItem | null; context: SpaceTimeChartContextType }>;
} & Omit<HTMLProps<HTMLDivElement>, 'onClick' | 'onMouseMove'>;

export type SpaceTimeChartContextType = {
  width: number;
  height: number;

  // Axis-swapping related data:
  timeAxis: Axis;
  spaceAxis: Axis;
  swapAxis: boolean;

  // This string is designed to be unique to each rendering:
  fingerprint: string;

  // Picking:
  pickingElements: PickingElement[];
  resetPickingElements: () => void;
  registerPickingElement: (element: PickingElement) => number;

  // Scales:
  timePixelOffset: number;
  spacePixelOffset: number;
  timeOrigin: number;
  timeScale: number;
  spaceOrigin: number;
  spaceScaleTree: NormalizedScaleTree;
  flatSteps: Set<number>;

  // Translation helpers:
  getTimePixel: TimeToPixel;
  getSpacePixel: SpaceToPixel;
  getPoint: DataToPoint;
  getTime: PixelToTime;
  getSpace: PixelToSpace;
  getData: PointToData;

  // Useful data:
  operationalPoints: OperationalPoint[];

  // Full theme:
  theme: SpaceTimeChartTheme;
  captionSize: number;

  // Other options:
  enableSnapping: boolean;
  hideTimeCaptions: boolean;
  hideGrid: boolean;
  hidePathsLabels: boolean;
  hideDates: boolean;
  showTicks: boolean;
};
