import type {
  LightRollingStockWithLiveries,
  SimulationSummaryResult,
} from 'common/api/osrdEditoastApi';

export type ValidityFilter = 'both' | 'valid' | 'invalid';

export type TrainScheduleWithDetails = {
  id: number;
  trainName: string;
  startTime: string;
  arrivalTime: string;
  /**
   * in ms
   */
  duration: number;
  stopsCount: number;
  pathLength: string;
  rollingStock?: LightRollingStockWithLiveries;
  mechanicalEnergyConsumed: number;
  speedLimitTag: string | null;
  labels: string[];
  invalidReason?: InvalidReason;
};

export type InvalidReason = Exclude<SimulationSummaryResult['status'], 'success'>;
