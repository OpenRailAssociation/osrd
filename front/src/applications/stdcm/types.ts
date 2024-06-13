import type {
  PathPropertiesFormatted,
  TrainSpaceTimeData,
} from 'applications/operationalStudies/types';
import type { STDCM_REQUEST_STATUS } from 'applications/stdcm/consts';
import type {
  LightRollingStock,
  PostV2TimetableByIdStdcmApiResponse,
  RollingStockWithLiveries,
  SimulationPowerRestrictionRange,
  SimulationResponse,
  TrainScheduleResult,
} from 'common/api/osrdEditoastApi';
import type { ValueOf } from 'utils/types';

export type StdcmRequestStatus = ValueOf<typeof STDCM_REQUEST_STATUS>;

export type StdcmV2SuccessResponse = Omit<
  Extract<PostV2TimetableByIdStdcmApiResponse, { status: 'success' }>,
  'simulation'
> & {
  simulation: Extract<SimulationResponse, { status: 'success' }>;
  rollingStock: LightRollingStock;
  creationDate: Date;
  speedLimitByTag?: string;
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
  speedSpaceChartData: {
    rollingStock: RollingStockWithLiveries;
    formattedPowerRestrictions: SimulationPowerRestrictionRange[];
    formattedPathProperties: PathPropertiesFormatted;
    departureTime: string;
  } | null;
  spaceTimeData: TrainSpaceTimeData[];
  selectedTrainSchedule: TrainScheduleResult;
  infraId: number;
  dispatchUpdateSelectedTrainId: (selectedTrainId: number) => void;
  setSpaceTimeData: React.Dispatch<React.SetStateAction<TrainSpaceTimeData[]>>;
};
