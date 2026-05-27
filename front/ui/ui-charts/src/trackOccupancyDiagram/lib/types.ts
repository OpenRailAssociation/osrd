import type { CurveStyle, PickingElement } from '../../common/types';
import { type TICKS_PATTERN } from './consts';

export type Track = {
  id: string;
  name?: string;
  line?: string;
};

export type OccupancyZone = {
  trainId: string;
  trackId: string;
  trainName: string;
  originStation?: string;
  destinationStation?: string;
  startTime: number;
  endTime: number;
  startDirection?: 'up' | 'down';
  endDirection?: 'up' | 'down';
  trailingText?: string;
  curveStyle?: CurveStyle;
  connectorStyle?: { width?: number; color?: string };
};

export type OccupancyZonePickingElement = PickingElement & {
  type: 'occupancyZone';
  pathId: string;
};

export type TickPattern = keyof typeof TICKS_PATTERN;
