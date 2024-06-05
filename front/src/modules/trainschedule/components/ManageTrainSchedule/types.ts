import type { Position } from 'geojson';

import type { TrainScheduleBase } from 'common/api/osrdEditoastApi';

export type SuggestedOP = {
  opId: string;
  name?: string;
  uic?: number;
  ch?: string;
  chLongLabel?: string;
  chShortLabel?: string;
  ci?: number;
  kp?: string;
  trigram?: string;
  offsetOnTrack: number;
  track: string;
  /** Distance from the beginning of the path in mm */
  positionOnPath: number;
  coordinates: Position;
  /** Metadata given to mark a point as wishing to be deleted by the user.
        It's useful for soft deleting the point (waiting to fix / remove all references)
        If true, the train schedule is consider as invalid and must be edited */
  deleted?: boolean;
  arrival?: string | null;
  locked?: boolean;
  stopFor?: string | null;
  theoreticalMargin?: string;
  onStopSignal?: boolean;
  // Metadatas given by ManageTrainScheduleMap click event to add origin/destination/via
  metadata?: {
    lineCode: number;
    lineName: string;
    trackName: string;
    trackNumber: number;
  };
};

export type Margin = {
  boundaries: string[];
  values: string[];
};

export type ValidConfig = {
  constraintDistribution: TrainScheduleBase['constraint_distribution'];
  rollingStockName: string;
  baseTrainName: string;
  timetableId: number;
  trainCount: number;
  trainStep: number;
  trainDelta: number;
  labels: string[];
  rollingStockComfort: TrainScheduleBase['comfort'];
  initialSpeed: number;
  usingElectricalProfiles: boolean;
  path: TrainScheduleBase['path'];
  margins: TrainScheduleBase['margins'];
  schedule: TrainScheduleBase['schedule'];
  powerRestrictions?: TrainScheduleBase['power_restrictions'];
  firstStartTime: string;
  speedLimitByTag?: string;
};
