import type { TrainSpaceTimeData } from 'applications/operationalStudies/types';
import type { STDCM_REQUEST_STATUS } from 'applications/stdcm/consts';
import type { StdcmSpeedSpaceChartData } from 'applications/stdcmV2/types';
import type {
  LightRollingStock,
  PostTimetableByIdStdcmApiResponse,
  SimulationResponse,
} from 'common/api/osrdEditoastApi';
import type { PathStep } from 'reducers/osrdconf/types';
import type { ValueOf } from 'utils/types';

export type StdcmRequestStatus = ValueOf<typeof STDCM_REQUEST_STATUS>;

export type StdcmV2SuccessResponse = Omit<
  Extract<PostTimetableByIdStdcmApiResponse, { status: 'success' }>,
  'simulation'
> & {
  simulation: Extract<SimulationResponse, { status: 'success' }>;
  rollingStock: LightRollingStock;
  creationDate: Date;
  speedLimitByTag?: string;
  simulationPathSteps: PathStep[];
};

export type SimulationReportSheetProps = {
  stdcmData: StdcmV2SuccessResponse;
  simulationReportSheetNumber: string;
  mapCanvas?: string;
  operationalPointsList: StdcmResultsOperationalPointsList;
};

export type StdcmResultsOperationalPointsList = StdcmResultsOperationalPoint[];

type StdcmResultsOperationalPoint = {
  opId: string;
  positionOnPath: number;
  time: string | null;
  name?: string;
  ch?: string;
  stop?: string | null;
  duration: number;
  departureTime: string;
  stopEndTime: string;
  trackName?: string;
};

export type StdcmV2Results = {
  stdcmResponse: StdcmV2SuccessResponse;
  speedSpaceChartData: StdcmSpeedSpaceChartData;
  spaceTimeData: TrainSpaceTimeData[] | null;
};

export type AllowanceValue =
  | {
      minutes: number;
      value_type: 'time_per_distance';
    }
  | {
      seconds: number;
      value_type: 'time';
    }
  | {
      percentage: number;
      value_type: 'percentage';
    };
