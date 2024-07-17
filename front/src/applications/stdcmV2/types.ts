import type { ManageTrainSchedulePathProperties } from 'applications/operationalStudies/types';
import type { StdcmV2SuccessResponse } from 'applications/stdcm/types';
import type { RollingStockWithLiveries } from 'common/api/osrdEditoastApi';
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

export type StdcmSimulationOutputs = {
  results: StdcmV2SuccessResponse;
  pathProperties: ManageTrainSchedulePathProperties;
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
