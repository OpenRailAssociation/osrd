import type { Position } from 'geojson';

import type {
  TrainCategory,
  LightRollingStockWithLiveries,
  PacedTrainException,
  CorePathfindingInputError,
  CorePathfindingNotFound,
  ReceptionSignal,
  SimulationSummaryResult,
  TrainScheduleResponse,
} from 'common/api/osrdEditoastApi';
import type { OccurrenceId } from 'reducers/osrdconf/types';
import type { Duration } from 'utils/duration';

export type SuggestedOP = {
  pathStepId: string | undefined;
  opId: string | undefined;
  name: string | undefined;
  uic?: number;
  ch?: string;
  kp?: string;
  trigram?: string;
  offsetOnTrack: number;
  track: string;
  trackName?: string;
  /** Distance from the beginning of the path in mm */
  positionOnPath: number;
  coordinates?: Position;
  arrival?: Duration | null; // value asked by user, number of seconds since departure
  stopFor?: Duration | null; // value asked by user
  theoreticalMargin?: string; // value asked by user
  theoreticalMarginSeconds?: string;
  calculatedMargin?: string;
  diffMargins?: string;
  receptionSignal?: ReceptionSignal;
  // Metadatas given by ManageTimetableItemMap click event to add origin/destination/via
  metadata?: {
    lineCode: number;
    lineName: string;
    trackName: string;
    trackNumber: number;
  };
};

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
      pathItemRespect: {
        margins: SimulationSummaryResultSuccess['path_item_respect_margins'];
        times: SimulationSummaryResultSuccess['path_item_respect_times'];
      };
    };

export type TimetableItemWithSummaries = Omit<
  TrainScheduleResponse,
  'train_name' | 'rolling_stock_name' | 'start_time' | 'paced'
> & {
  name: string;
  startTime: Date;
  stopsCount: number;
  rollingStockName: string;
  rollingStock?: LightRollingStockWithLiveries;
  speedLimitTag: string | null;
  labels: string[];
  summary?: SimulationSummary;
};

export type InvalidReason =
  | Extract<SimulationSummaryResult['status'], 'pathfinding_failure' | 'simulation_failed'>
  | CorePathfindingNotFound['error_type']
  | CorePathfindingInputError['error_type'];

export type SimulatedException = PacedTrainException & { summary?: SimulationSummary };

export type PacedTrainWithDetails = TimetableItemWithSummaries & {
  paced?: {
    timeWindow: Duration;
    interval: Duration;
    exceptions: SimulatedException[];
  };
};

// tmp type
export type PacedTrainWithPacedWithDetails = TimetableItemWithSummaries & {
  paced: {
    timeWindow: Duration;
    interval: Duration;
    exceptions: SimulatedException[];
  };
};

export type TimetableItemWithDetails = PacedTrainWithDetails;

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
