import type { LayerData, PowerRestrictionValues } from '@osrd-project/ui-charts';

import type {
  CoreIncompatibleConstraints,
  TrainSchedule,
  PathProperties,
  CorePathfindingResultSuccess,
  SimulationResponse,
  SimulationResponseSuccess,
  MacroNodeForm,
  RollingStockWithLiveries,
  TrainCategory,
  SearchResultItemStudy,
  StudyWithScenarios,
  ScenarioWithDetails,
  SearchResultItemScenario,
  PathItem,
  OperationalPointReference,
  MacroNoteForm,
  TrainScheduleResponse,
  PathfindingResult,
} from 'common/api/osrdEditoastApi';
import type { RangedValue } from 'common/types';
import type { ProjectionWaypoint } from 'modules/simulationResult/types';
import type { SuggestedOP } from 'modules/trainSchedule/types';
import type { Train, TrainScheduleWithPathOps } from 'reducers/osrdconf/types';
import type { Duration } from 'utils/duration';
import type { ArrayElement } from 'utils/types';

export type Board =
  | 'trains'
  | 'map'
  | 'macro'
  | 'std'
  | 'sdd'
  | 'tables'
  | 'conflicts'
  | 'chronogram';

export type PacedTrain = Omit<TrainScheduleResponse, 'id' | 'paced'> & {
  paced: NonNullable<TrainScheduleResponse['paced']>;
};

export type PacedTrainResponse = PacedTrain & {
  id: number;
};

export type TrainScheduleFromJson = Omit<TrainSchedule, 'start_time' | 'category'> & {
  start_time: string | number;
  category?: TrainCategory | string | null;
};

export type RoundTripsFromJson = ([number, number] | [number, null])[];

export type TimetableJsonPayload = {
  train_schedules: TrainScheduleFromJson[];
  macro_nodes?: MacroNodeForm[];
  macro_notes?: MacroNoteForm[];
  round_trips?: RoundTripsFromJson;
};

// Extraction of some required and non nullable properties from osrdEditoastApi's PathProperties type
export type ManageTrainSchedulePathProperties = {
  electrifications: NonNullable<PathProperties['electrifications']>;
  geometry: NonNullable<PathProperties['geometry']>;
  suggestedOperationalPoints: SuggestedOP[];
  length: number;
  trackSectionRanges: NonNullable<CorePathfindingResultSuccess['path']['track_section_ranges']>;
  incompatibleConstraints?: CoreIncompatibleConstraints;
};

export type MapPathProperties = Pick<ManageTrainSchedulePathProperties, 'length' | 'geometry'>;

export type PositionData<T extends 'gradient' | 'radius'> = {
  [key in T]: number;
} & {
  position: number;
};

export type BoundariesData = {
  /** List of `n` boundaries of the ranges.
        A boundary is a distance from the beginning of the path in mm. */
  boundaries: number[];
  /** List of `n+1` values associated to the ranges */
  values: number[];
};

export type ElectrificationValue = NonNullable<
  PathProperties['electrifications']
>['values'][number];

export type ElectricalProfileValue = Extract<
  SimulationResponse,
  { status: 'success' }
>['electrical_profiles']['values'][number];

export type ElectrificationUsage = ElectrificationValue & ElectricalProfileValue;

/** Start and stop are in meters */
export type ElectrificationRange = {
  electrificationUsage: ElectrificationUsage;
  start: number;
  stop: number;
};

export type ElectricalBoundariesData<T extends ElectrificationValue | ElectricalProfileValue> = {
  boundaries: number[];
  values: T[];
};

/** Electrifications start and stop are in meters */
export type PathPropertiesFormatted = {
  electrifications: ElectrificationRange[];
  curves: PositionData<'radius'>[];
  slopes: PositionData<'gradient'>[];
  operationalPoints: NonNullable<PathProperties['operational_points']>;
  geometry: NonNullable<PathProperties['geometry']>;
  voltages: RangedValue[];
};

export type PowerRestriction = ArrayElement<TrainSchedule['power_restrictions']>;

export type ElectrificationVoltage = {
  type: string;
  voltage?: string;
};

export type SimulationResults =
  | {
      isValid: false;
      train: Train;
      rollingStock?: RollingStockWithLiveries;
      path?: PathfindingResult;
      pathProperties?: PathPropertiesFormatted;
    }
  | {
      isValid: true;
      train: Train;
      rollingStock: RollingStockWithLiveries;
      simulation: SimulationResponseSuccess;
      path: CorePathfindingResultSuccess;
      pathProperties: PathPropertiesFormatted;
      powerRestrictions: LayerData<PowerRestrictionValues>[];
    };

export type OperationalPointWithTimeAndSpeed = {
  id: string | null;
  name: string | null;
  position: number;
  speed: number;
  time: Date;
  duration?: Duration;
  line_code: number | null;
  track_number: number | null;
  line_name: string | null;
  track_name: string | null;
  secondary_code?: string | null;
};

export type TrainScheduleRoundTripGroups = {
  oneWays: TrainScheduleWithPathOps[];
  roundTrips: (readonly [TrainScheduleWithPathOps, TrainScheduleWithPathOps])[];
  others: TrainScheduleWithPathOps[];
};

export type StudyCardDetails = SearchResultItemStudy | StudyWithScenarios;

export type ScenarioCardDetails = SearchResultItemScenario | ScenarioWithDetails;

export type CategoryColors = {
  base: string;
  strong: string;
  surface: string;
  // Soft accent (palette shade 30), e.g. the GOV hover outline
  soft: string;
};

export type ItineraryPathProperties = PathProperties & {
  length: number;
  incompatibleConstraints?: CoreIncompatibleConstraints;
  pathItemPositions?: number[];
};

export type PathProjectionResult = {
  path: PathItem[];
  operationalPoints: ProjectionWaypoint[];
  operationalPointDistances: number[];
  operationalPointReferences: OperationalPointReference[];
} & (
  | {
      pathfindingStatus: 'succeeded';
      pathfinding: CorePathfindingResultSuccess;
      geometry: PathProperties['geometry'];
      projectingOnSimulatedPathException: boolean | undefined;
    }
  | {
      pathfindingStatus: 'failed';
      pathfinding: undefined;
      geometry: undefined;
      projectingOnSimulatedPathException: undefined;
    }
);
