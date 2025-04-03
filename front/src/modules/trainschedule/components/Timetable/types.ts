import type {
  LightRollingStockWithLiveries,
  PathfindingInputError,
  PathfindingNotFound,
  SimulationSummaryResult,
  TrainScheduleResponse,
} from 'common/api/osrdEditoastApi';
import type { OccurrenceId, PacedTrainId, TrainScheduleId } from 'reducers/osrdconf/types';
import type { Duration } from 'utils/duration';

export type ValidityFilter = 'both' | 'valid' | 'invalid';

export type ScheduledPointsHonoredFilter = 'both' | 'honored' | 'notHonored';

export type TrainTypeFilter = 'both' | 'pacedTrain' | 'trainSchedule';

type SimulationSummaryResultSuccess = Extract<SimulationSummaryResult, { status: 'success' }>;

type TimetableItemWithSummaries = Omit<
  TrainScheduleResponse,
  'id' | 'train_name' | 'rolling_stock_name' | 'timetable_id' | 'start_time'
> & {
  name: string;
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

export type TrainScheduleWithDetails = TimetableItemWithSummaries & {
  id: TrainScheduleId;
};

export type PacedTrainWithDetails = TimetableItemWithSummaries & {
  id: PacedTrainId;
  paced: {
    duration: Duration;
    step: Duration;
  };
};

export type TimetableItemWithDetails = TrainScheduleWithDetails | PacedTrainWithDetails;

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
