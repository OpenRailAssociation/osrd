import type { ReactNode } from 'react';

import type {
  TimeChartContextType,
  ChartEventHandlers,
  Point,
  TimeChartStyles,
  SpaceChartStyles,
  BaseChartStyles,
} from '../../common/types';

// GLOBAL UTILITY TYPES:
export type Handler<P extends object> = (payload: P) => void;

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
export type SpaceToPixel = (position: number, fromEnd?: boolean) => number;
export type PixelToSpace = (y: number) => number;
export type PointToData = (point: Point) => DataPoint;
export type DataToPoint = (data: DataPoint) => Point;

// STYLES:
export type SpaceTimeChartTheme = BaseChartStyles & TimeChartStyles & SpaceChartStyles;

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
} & ChartEventHandlers<SpaceTimeChartContextType>;

export type SpaceTimeChartContextType = TimeChartContextType & {
  // Axis-swapping related data:
  timeAxis: Axis;
  spaceAxis: Axis;

  // Scales:
  spaceOrigin: number;
  spaceScaleTree: NormalizedScaleTree;
  flatSteps: Set<number>;

  // Translation helpers:
  getSpacePixel: SpaceToPixel;
  getSpace: PixelToSpace;

  // Useful data:
  operationalPoints: OperationalPoint[];

  captionSize: number;
};

export type WorkSchedule = {
  type: 'TRACK' | 'CATENARY';
  timeStart: Date;
  timeEnd: Date;
  spaceRanges: [number, number][];
};
