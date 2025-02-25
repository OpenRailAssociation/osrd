import type {
  LightRollingStockWithLiveries,
  PathfindingInputError,
  PathfindingNotFound,
  SimulationSummaryResult,
  TrainScheduleResult,
} from 'common/api/osrdEditoastApi';
import type { OccurrenceId, PacedTrainId, TrainScheduleId } from 'reducers/osrdconf/types';
import type { Duration } from 'utils/duration';

export type ValidityFilter = 'both' | 'valid' | 'invalid';

export type ScheduledPointsHonoredFilter = 'both' | 'honored' | 'notHonored';

export type TrainTypeFilter = 'both' | 'pacedTrain' | 'trainSchedule';

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

export type TimetableFilters = {
  uniqueTags: string[];
  nameLabelFilter: string;
  setNameLabelFilter: (nameLabelFilter: string) => void;
  rollingStockFilter: string;
  setRollingStockFilter: (rollingStockFilter: string) => void;
  validityFilter: ValidityFilter;
  setValidityFilter: (validityFilter: ValidityFilter) => void;
  scheduledPointsHonoredFilter: ScheduledPointsHonoredFilter;
  setScheduledPointsHonoredFilter: (
    scheduledPointsHonoredFilter: ScheduledPointsHonoredFilter
  ) => void;
  trainTypeFilter: TrainTypeFilter;
  setTrainTypeFilter: (trainType: TrainTypeFilter) => void;
  selectedTags: Set<string | null>;
  setSelectedTags: React.Dispatch<React.SetStateAction<Set<string | null>>>;
};

export type Occurrence = {
  id: OccurrenceId;
  trainName: string;
  rollingStock?: LightRollingStockWithLiveries;
  startTime: Date;
  arrivalTime: Date;
};
