import type { RollingStockWithLiveries } from 'common/api/osrdEditoastApi';

export type SimulationSheetData = {
  trainName: string | undefined;
  rollingStock: RollingStockWithLiveries;
  speedLimitByTag: string | undefined | null;
  departure_time: string;
  creationDate: Date;
};
