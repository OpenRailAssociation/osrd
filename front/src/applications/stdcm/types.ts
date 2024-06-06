import type {
  ManageTrainSchedulePathProperties,
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
};

export type SimulationReportSheetProps = {
  stdcmData: StdcmV2SuccessResponse;
  pathProperties?: ManageTrainSchedulePathProperties;
  rollingStockData: RollingStockWithLiveries;
  speedLimitByTag?: string;
  simulationReportSheetNumber: string;
  mapCanvas?: string;
  creationDate?: Date;
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
