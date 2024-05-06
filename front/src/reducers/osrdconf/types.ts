import type { Feature, Position } from 'geojson';

import type { PowerRestrictionRange, PointOnMap } from 'applications/operationalStudies/consts';
import type {
  RollingStockComfortType,
  PathResponse,
  AllowanceValue,
  TrackOffset,
  TrainScheduleBase,
} from 'common/api/osrdEditoastApi';
import type { AllowanceForm } from 'modules/trainschedule/components/ManageTrainSchedule/Allowances/types';
import type { InfraState } from 'reducers/infra';

export interface OsrdConfState extends InfraState {
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

export type PathStep = (
  | TrackOffset
  | {
      operational_point: string;
    }
  | {
      /** An optional secondary code to identify a more specific location */
      secondary_code?: string | null;
      trigram: string;
    }
  | {
      /** An optional secondary code to identify a more specific location */
      secondary_code?: string | null;
      /** The [UIC](https://en.wikipedia.org/wiki/List_of_UIC_country_codes) code of an operational point */
      uic: number;
    }
) & {
  id: string;
  /** Metadata given to mark a point as wishing to be deleted by the user.
        It's useful for soft deleting the point (waiting to fix / remove all references)
        If true, the train schedule is consider as invalid and must be edited */
  deleted?: boolean;
  arrival?: string | null;
  locked?: boolean;
  stop_for?: string | null;
  /** Distance from the beginning of the path in mm */
  positionOnPath?: number;
  coordinates: Position;
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
