import type { PickingElement } from '../../common/types';
import { type TICKS_PATTERN } from './consts';

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
