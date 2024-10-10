import type {
  LayerData,
  PowerRestrictionValues,
} from '@osrd-project/ui-speedspacechart/dist/types/chartTypes';

import type {
  IncompatibleConstraints,
  PathProperties,
  PathfindingResultSuccess,
  ProjectPathTrainResult,
  RollingStockWithLiveries,
  SimulationResponse,
  TrainScheduleBase,
  TrainScheduleResult,
} from 'common/api/osrdEditoastApi';
import type { RangedValue } from 'common/types';
import type { SuggestedOP } from 'modules/trainschedule/components/ManageTrainSchedule/types';
import type { ArrayElement } from 'utils/types';

export interface Step {
  uic: number;
  chCode?: string;
  yard?: string;
  name: string;
  trigram?: string;
  latitude?: number;
  longitude?: number;
  arrivalTime: string;
  departureTime: string;
  duration?: number;
}

export type ImportedTrainSchedule = {
  trainNumber: string;
  rollingStock: string | null;
  departureTime: string;
  arrivalTime: string;
  departure: string;
  steps: Step[];
  transilienName?: string;
};

export type TrainScheduleImportConfig = {
  from: string;
  to: string;
  date: string;
  startTime: string;
  endTime: string;
};

export type CichDictValue = {
  ciCode: number | string;
  chCode?: string;
};

export type OperationalPoint = NonNullable<PathProperties['operational_points']>[number];

// Extraction of some required and non nullable properties from osrdEditoastApi's PathProperties type
export type ManageTrainSchedulePathProperties = {
  manchetteOperationalPoints?: OperationalPoint[];
  electrifications: NonNullable<PathProperties['electrifications']>;
  geometry: NonNullable<PathProperties['geometry']>;
  suggestedOperationalPoints: SuggestedOP[];
  /** Operational points along the path (including origin and destination) and vias added by clicking on map */
  allWaypoints: SuggestedOP[];
  length: number;
  trackSectionRanges: NonNullable<PathfindingResultSuccess['track_section_ranges']>;
  incompatibleConstraints?: IncompatibleConstraints;
};

/**
 * Properties signal_updates time_end and time_start are in seconds taking count of the departure time
 */
export type TrainSpaceTimeData = {
  id: number;
  name: string;
} & ProjectPathTrainResult;

export type PositionData<T extends 'gradient' | 'radius'> = {
  [key in T]: number;
} & {
  position: number;
};

/** Start and stop are in meters */
export type ElectrificationRange = {
  electrificationUsage: ElectrificationUsage;
  start: number;
  stop: number;
};

type ElectrificationUsage = ElectrificationValue &
  SimulationResponseSuccess['electrical_profiles']['values'][number];

export type BoundariesData = {
  /** List of `n` boundaries of the ranges.
        A boundary is a distance from the beginning of the path in mm. */
  boundaries: number[];
  /** List of `n+1` values associated to the ranges */
  values: number[];
};

export type ElectricalBoundariesData<T extends ElectrificationValue | ElectricalProfileValue> = {
  boundaries: number[];
  values: T[];
};

export type ElectricalRangesData<T extends ElectrificationValue | ElectricalProfileValue> = {
  start: number;
  stop: number;
  values: T;
};

export type ElectrificationValue = NonNullable<
  PathProperties['electrifications']
>['values'][number];

export type ElectricalProfileValue = Extract<
  SimulationResponse,
  { status: 'success' }
>['electrical_profiles']['values'][number];

/** Electrifications start and stop are in meters */
export type PathPropertiesFormatted = {
  electrifications: ElectrificationRange[];
  curves: PositionData<'radius'>[];
  slopes: PositionData<'gradient'>[];
  operationalPoints: OperationalPoint[];
  geometry: NonNullable<PathProperties['geometry']>;
  voltages: RangedValue[];
};

export type PowerRestriction = ArrayElement<TrainScheduleBase['power_restrictions']>;

export type SimulationResponseSuccess = Extract<SimulationResponse, { status: 'success' }>;

export type ElectrificationVoltage = {
  type: string;
  voltage?: string;
};

export type SimulationResultsData = {
  selectedTrainSchedule?: TrainScheduleResult;
  selectedTrainRollingStock?: RollingStockWithLiveries;
  selectedTrainPowerRestrictions: LayerData<PowerRestrictionValues>[];
  trainSimulation?: SimulationResponseSuccess;
  pathProperties?: PathPropertiesFormatted;
  pathLength?: number;
  path?: PathfindingResultSuccess;
};

export type OperationalPointWithTimeAndSpeed = {
  id: string | null;
  name: string | null;
  position: number;
  speed: number;
  time: number;
  duration: number;
  line_code: number | null;
  track_number: number | null;
  line_name: string | null;
  track_name: string | null;
  ch?: string | null;
};
