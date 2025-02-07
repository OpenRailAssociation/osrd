import type { SimulationResponseSuccess } from 'applications/operationalStudies/types';
import type { RollingStockWithLiveries } from 'common/api/osrdEditoastApi';

export type SimulationSheetData = {
  trainName?: string;
  rollingStock: RollingStockWithLiveries;
  speedLimitByTag?: string | null;
  departure_time: string;
  creationDate: Date;
  simulation: SimulationResponseSuccess;
};
