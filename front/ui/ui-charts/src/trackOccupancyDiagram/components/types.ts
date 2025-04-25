import { type TICKS_PATTERN } from './consts';

export type Track = {
  id: string;
  name: string;
  line: string;
};

export type OccupancyZone = {
  trainId: string;
  trackId: string;
  arrivalTrainName: string;
  departureTrainName: string;
  arrivalDirection?: 'up' | 'down';
  departureDirection?: 'up' | 'down';
  color: string;
  originStation?: string;
  destinationStation?: string;
  arrivalTime: number;
  departureTime: number;
};

export type TickPattern = keyof typeof TICKS_PATTERN;
