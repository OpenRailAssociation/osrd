export interface Destination {
  uic: string;
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
}

export type TrainSchedule = {
  trainNumber: string;
  rollingStock: string;
  departureTime: string;
  arrivalTime: string;
  departure: Destination;
  arrival: Destination;
  steps: Step[];
  transilienName?: string;
};

export type TrainScheduleImportConfig = {
  from?: string;
  to?: string;
  date?: string;
  startTime?: string;
  endTime?: string;
};
