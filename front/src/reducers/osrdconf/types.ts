import type { Feature, Position } from 'geojson';

import type { PowerRestrictionRange, PointOnMap } from 'applications/operationalStudies/consts';
import type { PowerRestrictionV2 } from 'applications/operationalStudies/types';
import type {
  RollingStockComfortType,
  PathResponse,
  AllowanceValue,
  TrainScheduleBase,
  Distribution,
  PathfindingInputV2,
} from 'common/api/osrdEditoastApi';
import type { AllowanceForm } from 'modules/trainschedule/components/ManageTrainSchedule/Allowances/types';
import type { InfraState } from 'reducers/infra';
import type { ArrayElement } from 'utils/types';

export interface OsrdConfState extends InfraState {
  constraintDistribution: Distribution;
  rollingStockComfort: RollingStockComfortType;
  name: string;
  trainCount: number;
  trainStep: number;
  trainDelta: number;
  allowances: AllowanceForm[];
  usingElectricalProfiles: boolean;
  labels: string[];
  projectID?: number;
  studyID?: number;
  scenarioID?: number;
  pathfindingID?: number;
  timetableID?: number;
  rollingStockID?: number;
  speedLimitByTag?: string;
  // TODO: update the call to the api, to rename the fields begin & end -> begin_position & end_position
  powerRestrictionRanges: PowerRestrictionRange[];
  powerRestrictionV2: PowerRestrictionV2[];
  origin?: PointOnMap;
  initialSpeed?: number;
  // TODO TS2 : remove this property from store when drop v1
  departureTime: string;
  destination?: PointOnMap;
  vias: PointOnMap[];
  suggeredVias: PathResponse['steps'] | PointOnMap[];
  geojson?: PathResponse;
  originDate?: string;
  originTime?: string;
  originUpperBoundDate?: string;
  originUpperBoundTime?: string;
  originLinkedBounds: boolean;
  destinationDate?: string;
  destinationTime?: string;
  gridMarginBefore?: number;
  gridMarginAfter?: number;
  trainScheduleIDsToModify: number[];
  featureInfoClick: { displayPopup: boolean; feature?: Feature; coordinates?: number[] };
  pathSteps: (PathStep | null)[];
  rollingStockComfortV2?: TrainScheduleBase['comfort'];
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

export type PathItem = ArrayElement<PathfindingInputV2['path_items']>;

export type PathStep = PathItem & {
  id: string;
  /** Metadata given to mark a point as wishing to be deleted by the user.
        It's useful for soft deleting the point (waiting to fix / remove all references)
        If true, the train schedule is consider as invalid and must be edited */
  deleted?: boolean;
  arrival?: string | null;
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
