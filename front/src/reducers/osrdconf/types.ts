import type { Feature, Position } from 'geojson';

import type { PowerRestrictionV2 } from 'applications/operationalStudies/types';
import type { ArrivalTimeTypes } from 'applications/stdcmV2/types';
import type {
  AllowanceValue,
  Comfort,
  Distribution,
  PathItemLocation,
} from 'common/api/osrdEditoastApi';
import type { InfraState } from 'reducers/infra';

export interface OsrdConfState extends InfraState {
  constraintDistribution: Distribution;
  name: string;
  trainCount: number;
  trainStep: number;
  trainDelta: number;
  usingElectricalProfiles: boolean;
  labels: string[];
  projectID?: number;
  studyID?: number;
  scenarioID?: number;
  timetableID?: number;
  electricalProfileSetId?: number;
  workScheduleGroupId?: number;
  searchDatetimeWindow?: { begin: Date; end: Date };
  rollingStockID?: number;
  speedLimitByTag?: string;
  powerRestrictionV2: PowerRestrictionV2[];
  initialSpeed?: number;
  originDate?: string;
  originTime?: string;
  originUpperBoundDate?: string;
  originUpperBoundTime?: string;
  originLinkedBounds: boolean;
  gridMarginBefore?: number;
  gridMarginAfter?: number;
  featureInfoClick: { displayPopup: boolean; feature?: Feature; coordinates?: number[] };
  pathSteps: (PathStep | null)[];
  rollingStockComfortV2: Comfort;
  // Format ISO 8601
  startTime: string;
}

export interface StandardAllowance {
  type: AllowanceValue['value_type'];
  value?: number;
}

export interface OsrdStdcmConfState extends OsrdConfState {
  maximumRunTime: number;
  standardStdcmAllowance?: StandardAllowance;
}

export type PathStep = PathItemLocation & {
  id: string;
  /** Metadata given to mark a point as wishing to be deleted by the user.
        It's useful for soft deleting the point (waiting to fix / remove all references)
        If true, the train schedule is consider as invalid and must be edited */
  deleted?: boolean;
  arrival?: string | null;
  arrivalType?: ArrivalTimeTypes;
  arrivalToleranceBefore?: number;
  arrivalToleranceAfter?: number;
  locked?: boolean;
  stopFor?: string | null;
  theoreticalMargin?: string;
  onStopSignal?: boolean;
  kp?: string;
  /** Distance from the beginning of the path in mm */
  positionOnPath?: number;
  coordinates?: Position;
  // Metadatas given by the search endpoint in TypeAndPath (name)
  name?: string;
  ch?: string; // can be used to difference two steps from each other when they have same uic
  // Metadatas given by ManageTrainScheduleMap click event to add origin/destination/via
  metadata?: {
    lineCode: number;
    lineName: string;
    trackName: string;
    trackNumber: number;
  };
};
