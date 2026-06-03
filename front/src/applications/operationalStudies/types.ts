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
} from 'common/api/osrdEditoastApi';
import type { RangedValue } from 'common/types';
import type { PathOperationalPoint } from 'modules/simulationResult/types';
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

export type PacedTrainWithPaced = Omit<TrainScheduleResponse, 'id' | 'paced'> & {
  paced: NonNullable<TrainScheduleResponse['paced']>;
};

export type PacedTrainResponseWithPaced = PacedTrainWithPaced & {
  id: number;
};

export type PacedTrainFromJson = Omit<TrainSchedule, 'start_time' | 'category'> & {
  start_time: string | number;
  category?: TrainCategory | string | null;
};

export type RoundTripsFromJson = ([number, number] | [number, null])[];

export type TimetableJsonPayload = {
  paced_trains: PacedTrainFromJson[];
  macro_nodes?: MacroNodeForm[];
  macro_notes?: MacroNoteForm[];
  round_trips?: RoundTripsFromJson;
};

export type CichDictValue = {
  ciCode: number;
  chCode?: string;
};

// Extraction of some required and non nullable properties from osrdEditoastApi's PathProperties type
export type ManageTrainSchedulePathProperties = {
  manchetteOperationalPoints?: PathOperationalPoint[];
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
  ch?: string | null;
};

export type TrainScheduleRoundTripGroups = {
  oneWays: TrainScheduleWithPathOps[];
  roundTrips: (readonly [TrainScheduleWithPathOps, TrainScheduleWithPathOps])[];
  others: TrainScheduleWithPathOps[];
};

export type StudyCardDetails = SearchResultItemStudy | StudyWithScenarios;

export type ScenarioCardDetails = SearchResultItemScenario | ScenarioWithDetails;

export type CategoryColors = { normal: string; hovered: string; background: string };

export type ItineraryPathProperties = PathProperties & {
  length: number;
  incompatibleConstraints?: CoreIncompatibleConstraints;
};

export type PathProjectionResultOperationalPoint = Omit<
  PathProperties['operational_points'][number],
  'part'
>;

export type PathProjectionResult = {
  path: PathItem[];
  // Remove the part field as it won't be used anywhere in the app.
  // This avoid us to have to add hardcoded data in it.
  operationalPoints: PathProjectionResultOperationalPoint[];
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
