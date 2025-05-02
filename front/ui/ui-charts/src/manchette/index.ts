import '@osrd-project/ui-core/dist/theme.css';
import './styles/main.css';
import './consts';

export { default as Manchette, type ManchetteProps } from './components/Manchette';
export {
  default as ManchetteWithSpaceTimeChart,
  type ManchetteWithSpaceTimeChartProps,
} from './components/ManchetteWithSpaceTimeChart';

export { DEFAULT_ZOOM_MS_PER_PX } from './consts';

export { default as useManchetteWithSpaceTimeChart } from './hooks/useManchetteWithSpaceTimeChart';
export { default as usePaths } from './hooks/usePaths';

export type { Waypoint, ProjectPathTrainResult, InteractiveWaypoint } from './types';

export { positionMmToKm } from './utils';
export { timeScaleToZoomValue, isInteractiveWaypoint } from './utils/helpers';
