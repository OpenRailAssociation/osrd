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

export { DEFAULT_THEME } from './lib/consts';
export { SpaceTimeChartContext, SpaceTimeChartCanvasContext } from './lib/context';
export type {
  SpaceTimeChartProps,
  SpaceScale,
  OperationalPoint,
  SpaceTimeChartTheme,
  PathData,
  DataPoint,
  SpaceTimeChartContextType,
} from './lib/types';

export { isPathOnScreen } from './utils/geometry';
export { getSpaceAtTime } from './utils/scales';
export { computeRectZoomOffsets } from './utils/scales';
