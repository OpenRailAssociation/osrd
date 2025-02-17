import type {
  LightRollingStockWithLiveries,
  PathfindingInputError,
  PathfindingNotFound,
  SimulationSummaryResult,
  TrainScheduleResult,
} from 'common/api/osrdEditoastApi';
import type { PacedTrainId, TrainScheduleId } from 'reducers/osrdconf/types';
import type { Duration } from 'utils/duration';

export type ValidityFilter = 'both' | 'valid' | 'invalid';

export type ScheduledPointsHonoredFilter = 'both' | 'honored' | 'notHonored';

type SimulationSummaryResultSuccess = Extract<SimulationSummaryResult, { status: 'success' }>;

type TimetableItemWithDetails = Omit<
  TrainScheduleResult,
  'id' | 'train_name' | 'rolling_stock_name' | 'timetable_id' | 'start_time'
> & {
  trainName: string;
  startTime: Date;
  arrivalTime: Date | null;
  duration: Duration | null;
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

export type TrainScheduleWithDetails = TimetableItemWithDetails & {
  id: TrainScheduleId;
};

export type PacedTrainWithResult = TimetableItemWithDetails & {
  id: PacedTrainId;
  paced: {
    duration: Duration;
    step: Duration;
  };
};

export type TimetableItemResult = TrainScheduleWithDetails | PacedTrainWithResult;
