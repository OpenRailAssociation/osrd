import type {
  RollingStockWithLiveries,
  PostV2TimetableByIdStdcmApiResponse,
} from 'common/api/generatedEditoastApi';
import type { PathStep } from 'reducers/osrdconf/types';

export type StdcmSimulationResult = {
  createdAt: string;
  input: {
    origin?: PathStep | null;
    departureDate?: string;
    departureTime?: string;
    destination?: PathStep | null;
    pathSteps?: (PathStep | null)[];
    consist?: {
      tractionEngine: RollingStockWithLiveries | undefined;
    };
  };
  output: PostV2TimetableByIdStdcmApiResponse;
};

/** This type is used for StdcmConsist, StdcmOrigin, StdcmDestination and StdcmVias components */
export type StdcmConfigCardProps = {
  setCurrentSimulationInputs: React.Dispatch<
    React.SetStateAction<StdcmSimulationResult['input'] | undefined>
  >;
  disabled?: boolean;
};
