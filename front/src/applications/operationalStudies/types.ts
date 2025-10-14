import type { LayerData, PowerRestrictionValues } from '@osrd-project/ui-charts';

import type {
  IncompatibleConstraints,
  PacedTrain,
  PathProperties,
  PathfindingResultSuccess,
  SimulationResponse,
  SimulationResponseSuccess,
  TrainSchedule,
  MacroNodeForm,
  RollingStockWithLiveries,
  TrainCategory,
  SearchResultItemStudy,
  StudyWithScenarios,
  ScenarioWithDetails,
  SearchResultItemScenario,
} from 'common/api/osrdEditoastApi';
import type { RangedValue } from 'common/types';
import type { PathOperationalPoint } from 'modules/simulationResult/types';
import type { SuggestedOP } from 'modules/timetableItem/types';
import type { Train, TimetableItemWithPathOps } from 'reducers/osrdconf/types';
import type { Duration } from 'utils/duration';
import type { ArrayElement } from 'utils/types';

export type Board = 'trains' | 'map' | 'macro' | 'std' | 'sdd' | 'tables' | 'conflicts';

export type TrainScheduleFromJson = Omit<TrainSchedule, 'category'> & {
  category?: TrainCategory | string | null;
};

export type PacedTrainFromJson = Omit<PacedTrain, 'category'> & {
  category?: TrainCategory | string | null;
};

export type RoundTripsFromJson = {
  train_schedules: ([number, number] | [number, null])[];
  paced_trains: ([number, number] | [number, null])[];
};

export type TimetableJsonPayload = {
  train_schedules: TrainScheduleFromJson[];
  paced_trains: PacedTrainFromJson[];
  macro_nodes?: MacroNodeForm[];
  round_trips?: RoundTripsFromJson;
};

export type CichDictValue = {
  ciCode: number;
  chCode?: string;
};

// Extraction of some required and non nullable properties from osrdEditoastApi's PathProperties type
export type ManageTimetableItemPathProperties = {
  manchetteOperationalPoints?: PathOperationalPoint[];
  electrifications: NonNullable<PathProperties['electrifications']>;
  geometry: NonNullable<PathProperties['geometry']>;
  suggestedOperationalPoints: SuggestedOP[];
  length: number;
  trackSectionRanges: NonNullable<PathfindingResultSuccess['path']['track_section_ranges']>;
  incompatibleConstraints?: IncompatibleConstraints;
};

export type MapPathProperties = Pick<ManageTimetableItemPathProperties, 'length' | 'geometry'>;

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
  | { isValid: false; train: Train; rollingStock?: RollingStockWithLiveries }
  | {
      isValid: true;
      train: Train;
      rollingStock: RollingStockWithLiveries;
      simulation: SimulationResponseSuccess;
      path: PathfindingResultSuccess;
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

export type TimetableItemRoundTripGroups = {
  oneWays: TimetableItemWithPathOps[];
  roundTrips: (readonly [TimetableItemWithPathOps, TimetableItemWithPathOps])[];
  others: TimetableItemWithPathOps[];
};

export type StudyCardDetails = SearchResultItemStudy | StudyWithScenarios;

export type ScenarioCardDetails = SearchResultItemScenario | ScenarioWithDetails;

export type CategoryColors = { normal: string; hovered: string; background: string };
