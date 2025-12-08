import { type TICKS_PATTERN } from './consts';
import type { PickingElement } from '../../common/types';
import type {
  TimeToPixel,
  SpaceToPixel,
  DataToPoint,
  PixelToTime,
  PixelToSpace,
  PointToData,
  SpaceTimeChartTheme,
} from '../../spaceTimeChart/lib/types';

export type Track = {
  id: string;
  name?: string;
  line?: string;
};

export type OccupancyZone = {
  trainId: string;
  trackId: string;
  color?: string;
  size?: number;
  trainName: string;
  originStation?: string;
  destinationStation?: string;
  startTime: number;
  endTime: number;
  startDirection?: 'up' | 'down';
  endDirection?: 'up' | 'down';
  trailingText?: string;
};

export type OccupancyZonePickingElement = PickingElement & {
  type: 'occupancyZone';
  pathId: string;
};

export type TickPattern = keyof typeof TICKS_PATTERN;

export type TrackOccupancyDiagramContextType = {
  width: number;
  height: number;

  // This string is designed to be unique to each rendering:
  fingerprint: string;

  // Picking:
  pickingElements: PickingElement[];
  resetPickingElements: () => void;
  registerPickingElement: (element: PickingElement) => number;

  // Scales:
  timeScale: number;

  // Translation helpers:
  getTimePixel: TimeToPixel;
  getSpacePixel: SpaceToPixel;
  getPoint: DataToPoint;
  getTime: PixelToTime;
  getSpace: PixelToSpace;
  getData: PointToData;

  // Full theme:
  theme: SpaceTimeChartTheme;
};
