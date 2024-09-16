import type {
  LayerData,
  PowerRestrictionValues,
} from '@osrd-project/ui-speedspacechart/dist/types/chartTypes';

import type {
  PathPropertiesFormatted,
  SimulationResponseSuccess,
  TrainSpaceTimeData,
} from 'applications/operationalStudies/types';
import type {
  PathfindingResultSuccess,
  RollingStockWithLiveries,
  TrainScheduleResult,
} from 'common/api/osrdEditoastApi';
import type { ArrayElement } from 'utils/types';

export type SpeedLimitTagValue = ArrayElement<SimulationResponseSuccess['mrsp']['values']>;

export type SpeedSpaceChartData = {
  rollingStock: RollingStockWithLiveries;
  formattedPowerRestrictions: LayerData<PowerRestrictionValues>[] | undefined;
  simulation?: SimulationResponseSuccess;
  formattedPathProperties: PathPropertiesFormatted;
  departureTime: string;
};

export type ProjectionData = {
  trainSchedule: TrainScheduleResult;
  projectedTrains: TrainSpaceTimeData[];
  path: PathfindingResultSuccess;
  allTrainsProjected: boolean;
};
