import type { ManageTrainSchedulePathProperties } from 'applications/operationalStudies/types';
import type STDCM_REQUEST_STATUS from 'applications/stdcm/consts';
import type {
  PostV2TimetableByIdStdcmApiResponse,
  RollingStockWithLiveries,
} from 'common/api/osrdEditoastApi';
import type { ValueOf } from 'utils/types';

export type StdcmRequestStatus = ValueOf<typeof STDCM_REQUEST_STATUS>;

export type StdcmV2SuccessResponse = Extract<
  PostV2TimetableByIdStdcmApiResponse,
  { status: 'success' }
>;

export type SimulationReportSheetProps = {
  stdcmData: StdcmV2SuccessResponse;
  pathProperties?: ManageTrainSchedulePathProperties;
  rollingStockData: RollingStockWithLiveries;
  speedLimitByTag?: string;
  simulationReportSheetNumber?: string;
  mapCanvas?: string;
  creationDate?: Date;
};
