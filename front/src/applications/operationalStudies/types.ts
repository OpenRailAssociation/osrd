import { TrackLocation } from 'common/api/osrdEditoastApi';

export interface Destination {
  uic: number;
  yard?: string;
  name: string;
  trigram: string;
  latitude: number;
  longitude: number;
}

export interface Step extends Destination {
  arrivalTime: string;
  departureTime: string;
  duration?: number;
  tracks: TrackLocation[];
}

export type TrainSchedule = {
  trainNumber: string;
  rollingStock: string;
  departureTime: string;
  arrivalTime: string;
  departure: string;
  steps: Step[];
  transilienName?: string;
};

export type ImportedTrainSchedule = {
  trainNumber: string;
  rollingStock: string;
  departureTime: string;
  arrivalTime: string;
  departure: string;
  steps: (Destination & {
    arrivalTime: string;
    departureTime: string;
  })[];
  transilienName?: string;
};

export type TrainScheduleImportConfig = {
  from: string;
  to: string;
  date: string;
  startTime: string;
  endTime: string;
};
