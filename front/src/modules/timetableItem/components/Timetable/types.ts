import type {
  TrainCategory,
  LightRollingStockWithLiveries,
  PacedTrainException,
  PathfindingInputError,
  PathfindingNotFound,
  SimulationSummaryResult,
  TrainMainCategories,
  TrainScheduleResponse,
  SubCategory,
} from 'common/api/osrdEditoastApi';
import type { OccurrenceId, PacedTrainId, TrainScheduleId } from 'reducers/osrdconf/types';
import type { Duration } from 'utils/duration';

export type ValidityFilter = 'both' | 'valid' | 'invalid';

export type ScheduledPointsHonoredFilter = 'both' | 'honored' | 'notHonored';

export type TrainTypeFilter = 'both' | 'pacedTrain' | 'trainSchedule';

export type TrainCategoryFilter =
  | 'all'
  | 'noCategory'
  | (TrainMainCategories | SubCategory['code']);

type SimulationSummaryResultSuccess = Extract<SimulationSummaryResult, { status: 'success' }>;

export type SimulationSummary =
  | { isValid: false; invalidReason: InvalidReason }
  | {
      isValid: true;
      /** Travel time */
      duration: Duration;
      pathLength: string;
      mechanicalEnergyConsumed: number;
      notHonoredReason?: 'scheduleNotHonored' | 'trainTooFast';
      pathItemTimes: {
        base: SimulationSummaryResultSuccess['path_item_times_base'];
        provisional: SimulationSummaryResultSuccess['path_item_times_provisional'];
        final: SimulationSummaryResultSuccess['path_item_times_final'];
      };
    };

export type TimetableItemWithSummaries = Omit<
  TrainScheduleResponse,
  'id' | 'train_name' | 'rolling_stock_name' | 'timetable_id' | 'start_time'
> & {
  name: string;
  startTime: Date;
  stopsCount: number;
  rollingStock?: LightRollingStockWithLiveries;
  speedLimitTag: string | null;
  labels: string[];
  summary?: SimulationSummary;
};

export type InvalidReason =
  | Extract<SimulationSummaryResult['status'], 'pathfinding_failure' | 'simulation_failed'>
  | PathfindingNotFound['error_type']
  | PathfindingInputError['error_type'];

export type TrainScheduleWithDetails = TimetableItemWithSummaries & {
  id: TrainScheduleId;
};

export type SimulatedException = PacedTrainException & { summary?: SimulationSummary };

export type PacedTrainWithDetails = TimetableItemWithSummaries & {
  id: PacedTrainId;
  exceptions: SimulatedException[];
  paced: {
    timeWindow: Duration;
    interval: Duration;
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
  trainCategoryFilter: TrainCategoryFilter;
  setTrainCategoryFilter: (categoryOption: TrainCategoryFilter) => void;
};

export type ExceptionChangeGroups = Omit<
  PacedTrainException,
  'key' | 'occurrence_index' | 'disabled'
>;

export type Occurrence = {
  id: OccurrenceId;
  /**
   * Field present only for a regular occurrence.
   * An added exception can only be deleted, not disabled.
   */
  disabled?: boolean;
  category?: TrainCategory | null;
  occurrenceIndex?: number; // Optional, only if not created
  trainName: string;
  rollingStock?: LightRollingStockWithLiveries;
  startTime: Date;
  stopsCount: number;
  exceptionChangeGroups?: ExceptionChangeGroups;
  summary?: SimulationSummary;
};

export type ExceptionChangeGroupName = keyof ExceptionChangeGroups;
