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
  trainName: string;
  originStation?: string;
  destinationStation?: string;
  startTime: number;
  endTime: number;
  startDirection?: 'up' | 'down';
  endDirection?: 'up' | 'down';
};

export type OccupancyZonePickingElement = { type: 'occupancyZone'; trainId: string };

export type TickPattern = keyof typeof TICKS_PATTERN;
