import type {
  LightRollingStockWithLiveries,
  SimulationSummaryResult,
} from 'common/api/osrdEditoastApi';

export type ValidityFilter = 'both' | 'valid' | 'invalid';

export type ScheduledPointsHonoredFilter = 'both' | 'honored' | 'notHonored';

type SimulationSummaryResultSuccess = Extract<SimulationSummaryResult, { status: 'success' }>;

export type TrainScheduleWithDetails = {
  id: number;
  trainName: string;
  startTime: string;
  arrivalTime: string;
  /** in ms */
  duration: number;
  stopsCount: number;
  pathLength: string;
  rollingStock?: LightRollingStockWithLiveries;
  mechanicalEnergyConsumed: number;
  speedLimitTag: string | null;
  labels: string[];
  invalidReason?: InvalidReason;
  notHonoredReason?: 'scheduleNotHonored' | 'trainTooFast';
  scheduledPointsNotHonored?: boolean;
  isValid: boolean;
  pathItemTimes?: {
    base: SimulationSummaryResultSuccess['path_item_times_base'];
    provisional: SimulationSummaryResultSuccess['path_item_times_provisional'];
    final: SimulationSummaryResultSuccess['path_item_times_final'];
  };
};

export type InvalidReason = Exclude<SimulationSummaryResult['status'], 'success'>;
