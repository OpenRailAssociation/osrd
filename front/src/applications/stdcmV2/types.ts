import type { ManageTrainSchedulePathProperties } from 'applications/operationalStudies/types';
import type { StdcmV2SuccessResponse } from 'applications/stdcm/types';
import type { RollingStockWithLiveries } from 'common/api/osrdEditoastApi';
import type { SpeedSpaceChartData } from 'modules/simulationResult/types';
import type { PathStep } from 'reducers/osrdconf/types';

export type StdcmSimulationInputs = {
  departureDate?: string;
  departureTime?: string;
  pathSteps: (PathStep | null)[];
  consist?: {
    tractionEngine?: RollingStockWithLiveries;
    speedLimitByTag?: string;
  };
};

export type StdcmSpeedSpaceChartData = Pick<
  SpeedSpaceChartData,
  'formattedPathProperties' | 'formattedPowerRestrictions'
> | null;

export type StdcmSimulationOutputs = {
  results: StdcmV2SuccessResponse;
  pathProperties: ManageTrainSchedulePathProperties;
  speedSpaceChartData: StdcmSpeedSpaceChartData;
};

export type StdcmSimulation = {
  id: number;
  creationDate: Date;
  inputs: StdcmSimulationInputs;
  outputs?: StdcmSimulationOutputs;
};

/** This type is used for StdcmConsist, StdcmOrigin, StdcmDestination and StdcmVias components */
export type StdcmConfigCardProps = {
  setCurrentSimulationInputs: React.Dispatch<React.SetStateAction<StdcmSimulationInputs>>;
  disabled?: boolean;
};

export enum ArrivalTimeTypes {
  PRECISE_TIME = 'preciseTime',
  ASAP = 'asSoonAsPossible',
}

export enum StdcmConfigErrorTypes {
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
