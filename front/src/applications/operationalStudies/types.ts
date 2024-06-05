import type { PathProperties, PathResponse, PathfindingResult } from 'common/api/osrdEditoastApi';
import type { SuggestedOP } from 'modules/trainschedule/components/ManageTrainSchedule/types';

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
  tracks: {
    position: number;
    track: string;
  }[];
}
export interface StepV2 extends Destination {
  arrivalTime: string;
  departureTime: string;
  duration?: number;
}

export type TrainSchedule = {
  trainNumber: string;
  rollingStock: string | null;
  departureTime: string;
  arrivalTime: string;
  departure: string;
  steps: Step[];
  transilienName?: string;
};

export type TrainScheduleV2 = {
  trainNumber: string;
  rollingStock: string | null;
  departureTime: string;
  arrivalTime: string;
  departure: string;
  steps: StepV2[];
  transilienName?: string;
};

export interface TrainScheduleWithPathRef extends TrainSchedule {
  pathRef: string;
}

export interface TrainScheduleWithPath extends TrainScheduleWithPathRef {
  pathId: number;
  rollingStockId: number;
  pathFinding: PathResponse;
}

export type ImportedTrainSchedule = {
  trainNumber: string;
  rollingStock: string | null;
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
type SuccesfulPathfindingResult = Extract<PathfindingResult, { status: 'success' }>;
// Extraction of some required and non nullable properties from osrdEditoastApi's PathProperties type
export type ManageTrainSchedulePathProperties = {
  electrifications: NonNullable<PathProperties['electrifications']>;
  geometry: NonNullable<PathProperties['geometry']>;
  /** Operational points along the path and vias added by clicking on map */
  suggestedOperationalPoints: SuggestedOP[];
  length: number;
  trackSectionRanges: NonNullable<SuccesfulPathfindingResult['track_section_ranges']>;
};
