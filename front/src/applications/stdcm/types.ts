import type {
  LayerData,
  PowerRestrictionValues,
} from '@osrd-project/ui-speedspacechart/dist/types/chartTypes';

import type {
  PathPropertiesFormatted,
  TrainSpaceTimeData,
} from 'applications/operationalStudies/types';
import type { STDCM_REQUEST_STATUS } from 'applications/stdcm/consts';
import type {
  LightRollingStock,
  PostV2TimetableByIdStdcmApiResponse,
  RollingStockWithLiveries,
  SimulationResponse,
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
    formattedPowerRestrictions?: LayerData<PowerRestrictionValues>[];
    formattedPathProperties: PathPropertiesFormatted;
    departureTime: string;
  } | null;
  spaceTimeData: TrainSpaceTimeData[] | null;
};
