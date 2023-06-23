import { TrackLocation } from 'common/api/osrdEditoastApi';

export interface Destination {
  uic: number;
  yard: string;
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

interface JsonImportTrainScheduleStep extends Destination {
  arrivalTime: string;
  departureTime: string;
}

export type JsonImportTrainSchedule = {
  trainNumber: string;
  rollingStock: string;
  departureTime: string;
  arrivalTime: string;
  departure: Destination;
  steps: JsonImportTrainScheduleStep[];
  transilienName?: string;
};

export type TrainScheduleImportConfig = {
  from: string;
  to: string;
  date: string;
  startTime: string;
  endTime: string;
};

export type GraouTrainScheduleStep = {
  arrivalTime: string;
  city: string;
  department: string;
  departureTime: string;
  duration: number;
  latitude: string;
  line: number;
  longitude: string;
  name: string;
  region: string;
  stepNumber: number;
  trigram: string;
  uic: string;
};

export type GraouTrainSchedule = {
  arrivalTime: string;
  departure: string;
  departureTime: string;
  numTransilien?: string;
  rollingStock: string;
  steps: GraouTrainScheduleStep[];
  trainNumber: string;
};
