import type { Feature, Position } from 'geojson';

import type { ReceptionSignal, TrainScheduleBase } from 'common/api/osrdEditoastApi';
import type { Duration } from 'utils/duration';

export type SuggestedOP = {
  pathStepId?: string;
  opId?: string;
  name?: string;
  uic?: number;
  ch?: string;
  kp?: string;
  trigram?: string;
  offsetOnTrack: number;
  track: string;
  trackName?: string;
  /** Distance from the beginning of the path in mm */
  positionOnPath: number;
  coordinates?: Position;
  /** Metadata given to mark a point as wishing to be deleted by the user.
        It's useful for soft deleting the point (waiting to fix / remove all references)
        If true, the train schedule is consider as invalid and must be edited */
  deleted?: boolean;
  arrival?: Duration | null; // value asked by user, number of seconds since departure
  locked?: boolean;
  stopFor?: Duration | null; // value asked by user
  theoreticalMargin?: string; // value asked by user
  theoreticalMarginSeconds?: string;
  calculatedMargin?: string;
  diffMargins?: string;
  calculatedArrival?: string | null;
  calculatedDeparture?: string | null;
  receptionSignal?: ReceptionSignal;
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
  // TODO Paced train : rename this and firstStartTime to trainName and startTime in https://github.com/OpenRailAssociation/osrd/issues/10791
  baseTrainName: string;
  timetableId: number;
  trainCount: number;
  trainStep: number;
  trainDelta: number;
  cadence: string;
  timeRangeDuration: string;
  labels: string[];
  rollingStockComfort: TrainScheduleBase['comfort'];
  initialSpeed: number;
  usingElectricalProfiles: boolean;
  usingSpeedLimits: boolean;
  path: TrainScheduleBase['path'];
  margins: TrainScheduleBase['margins'];
  schedule: TrainScheduleBase['schedule'];
  powerRestrictions?: TrainScheduleBase['power_restrictions'];
  firstStartTime: string;
  speedLimitByTag?: string;
  editingTrainIsPacedTrain: boolean;
};

export type FeatureInfoClick = {
  feature: Feature;
  coordinates: number[];
  isOperationalPoint: boolean;
};
