import type {
  LightRollingStockWithLiveries,
  PathfindingInputError,
  PathfindingNotFound,
  SimulationSummaryResult,
  TrainScheduleResult,
} from 'common/api/osrdEditoastApi';
import type { TrainId } from 'reducers/osrdconf/types';

export type ValidityFilter = 'both' | 'valid' | 'invalid';

export type ScheduledPointsHonoredFilter = 'both' | 'honored' | 'notHonored';

type SimulationSummaryResultSuccess = Extract<SimulationSummaryResult, { status: 'success' }>;

export type TrainScheduleWithDetails = Omit<
  TrainScheduleResult,
  'id' | 'train_name' | 'rolling_stock_name' | 'timetable_id' | 'start_time'
> & {
  id: TrainId;
  trainName: string;
  startTime: Date;
  arrivalTime: Date | null;
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

export type InvalidReason =
  | Extract<SimulationSummaryResult['status'], 'pathfinding_failure' | 'simulation_failed'>
  | PathfindingNotFound['error_type']
  | PathfindingInputError['error_type'];
