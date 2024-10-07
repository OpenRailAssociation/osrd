import type {
  LightRollingStockWithLiveries,
  PathfindingInputError,
  PathfindingNotFound,
  SimulationSummaryResult,
} from 'common/api/osrdEditoastApi';

export type ValidityFilter = 'both' | 'valid' | 'invalid';

export type ScheduledPointsHonoredFilter = 'both' | 'honored' | 'notHonored';

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
};

export type InvalidReason =
  | Extract<SimulationSummaryResult['status'], 'pathfinding_failure' | 'simulation_failed'>
  | PathfindingNotFound['error_type']
  | PathfindingInputError['error_type'];
