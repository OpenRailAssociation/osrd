import type { Feature } from 'geojson';

import type { PowerRestrictionRange, PointOnMap } from 'applications/operationalStudies/consts';
import type {
  RollingStockComfortType,
  PathResponse,
  AllowanceValue,
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
}

export interface StandardAllowance {
  type: AllowanceValue['value_type'];
  value: number;
}
export interface OsrdStdcmConfState extends OsrdConfState {
  maximumRunTime: number;
  standardStdcmAllowance?: StandardAllowance;
}
