import './styles/main.css';

export * from './components/SpaceTimeChart';
export * from './components/PathLayer';
export * from './components/ConflictLayer';
export * from './components/ConflictTooltip';
export * from './components/Tooltip';
export * from './components/OccupancyBlockLayer';
export * from './components/WorkScheduleLayer';
export * from './components/PatternRect';
export * from './components/Quadrilateral';
export * from './components/ZoomRect';
export * from './components/TimeCaptions';

export { usePicking, useDraw } from './hooks/useCanvas';

export { DEFAULT_THEME } from './lib/consts';
export { CanvasContext, MouseContext, SpaceTimeChartContext } from './lib/context';
export type {
  HoveredItem,
  SpaceTimeChartProps,
  SpaceScale,
  OperationalPoint,
  SpaceTimeChartTheme,
  PathData,
  Point,
  DataPoint,
  SpaceTimeChartContextType,
  DrawingFunction,
  PickingDrawingFunction,
  PickingElement,
} from './lib/types';

export { isPathOnScreen } from './utils/geometry';
export { getSpaceAtTime } from './utils/scales';
export { getCrispLineCoordinate } from './utils/canvas';
export { computeRectZoomOffsets } from './utils/scales';
