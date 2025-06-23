import type {
  RollingStockWithLiveries,
  SimulationResponseSuccess,
} from 'common/api/osrdEditoastApi';

export type SimulationSheetData = {
  trainName?: string;
  rollingStock: RollingStockWithLiveries;
  speedLimitByTag?: string | null;
  departure_time: string;
  creationDate: Date;
  simulation: SimulationResponseSuccess;
};
