import type { ManageTrainSchedulePathProperties } from 'applications/operationalStudies/types';
import type { StdcmV2SuccessResponse } from 'applications/stdcm/types';
import type { RollingStockWithLiveries } from 'common/api/osrdEditoastApi';
import type { SpeedSpaceChartData } from 'modules/simulationResult/types';
import type { StdcmPathStep } from 'reducers/osrdconf/types';

export type StdcmSimulationInputs = {
  departureDatetime?: Date;
  pathSteps: StdcmPathStep[];
  consist?: {
    tractionEngine?: RollingStockWithLiveries;
    speedLimitByTag?: string;
  };
};

export type StdcmSimulationOutputs = {
  results: StdcmV2SuccessResponse;
  pathProperties: ManageTrainSchedulePathProperties;
  speedSpaceChartData: SpeedSpaceChartData;
};

export type StdcmSimulation = {
  id: number;
  creationDate: Date;
  inputs: StdcmSimulationInputs;
  outputs?: StdcmSimulationOutputs;
};

/** This type is used for StdcmConsist, StdcmOrigin, StdcmDestination and StdcmVias components */
export type StdcmConfigCardProps = {
  disabled?: boolean;
};

export enum ArrivalTimeTypes {
  PRECISE_TIME = 'preciseTime',
  ASAP = 'asSoonAsPossible',
}

export enum StdcmConfigErrorTypes {
  INFRA_NOT_LOADED = 'infraNotLoaded',
  MISSING_LOCATION = 'missingLocation',
  PATHFINDING_FAILED = 'pathfindingFailed',
  BOTH_POINT_SCHEDULED = 'bothPointAreScheduled',
  NO_SCHEDULED_POINT = 'noScheduledPoint',
}

export type StdcmConfigErrors = {
  errorType: StdcmConfigErrorTypes;
  errorDetails?: { originTime: string; destinationTime: string };
};

export type ScheduleConstraint = {
  date: Date;
  hours: number;
  minutes: number;
};
export enum StdcmStopTypes {
  PASSAGE_TIME = 'passageTime',
  DRIVER_SWITCH = 'driverSwitch',
  SERVICE_STOP = 'serviceStop',
}
