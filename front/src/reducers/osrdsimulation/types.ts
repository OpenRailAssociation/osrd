import * as d3 from 'd3';
import { TimeString } from 'common/types';
import { SIGNAL_BASE_DEFAULT } from 'applications/operationalStudies/components/SimulationResults/simulationResultsConsts';

export type MergedDataPoint<T = number> = {
  [key: string]: number | T;
  value0: number | T;
  value1: number | T;
};
export type ConsolidatedMergeDataPoint = MergedDataPoint<Date | null>;

export interface Chart {
  width: number;
  height: number;
  margin: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  x: d3.ScaleTime<number, number>;
  xAxis: d3.Selection<SVGGElement, unknown, null, undefined>;
  xAxisGrid: d3.Selection<SVGGElement, unknown, null, undefined>;
  y: d3.ScaleLinear<number, number>;
  yAxis: d3.Selection<SVGGElement, unknown, null, undefined>;
  yAxisGrid: d3.Selection<SVGGElement, unknown, null, undefined>;
  svg: d3.Selection<SVGGElement, unknown, null, undefined>;
  drawZone: d3.Selection<SVGGElement, unknown, null, undefined>;
}
export interface AllowancesSetting {
  base: boolean;
  baseBlocks: boolean;
  eco: boolean;
  ecoBlocks: boolean;
}

export type AllowancesSettings = Record<string | number, AllowancesSetting>;

export interface Position<Time = number> {
  time: Time;
  position: number;
}
export type ConsolidatedPosition<DateType = Date> = Position<DateType | null>;

export type PositionSpeedTime<Time = number> = Position<Time> & {
  speed: number;
};
export type ConsolidatePositionSpeed<DateType = Date> = PositionSpeedTime<DateType | null>;

export interface Stop {
  id: string | null;
  name: string | null;
  time: number;
  duration: number;
  position: number;
  line_code: number;
  track_number: number;
  line_name: string;
  track_name: string;
}

export interface RouteAspect<Time = number, Color = number> {
  signal_id?: string;
  route_id: string;
  time_start: Time;
  time_end: Time;
  position_start: number;
  position_end: number;
  color: Color;
  blinking: boolean;
}
export type ConsolidatedRouteAspect<DateType = Date> = RouteAspect<DateType | null, string>;

export interface SignalAspect<Time = number, Color = number> {
  signal_id: string;
  time_start: Time;
  time_end: Time;
  color: Color;
  blinking: boolean;
  aspect_label: string;
}
export type ConsolidatedSignalAspect<DateType = Date> = SignalAspect<DateType | null, string>;

export interface Regime {
  head_positions: Position[][];
  tail_positions: Position[][];
  speeds: PositionSpeedTime[];
  stops: Stop[];
  route_aspects: RouteAspect[];
  signal_aspects?: SignalAspect[];
  error?: string;
  mechanical_energy_consumed: number;
}

export interface ElectrificationConditions {
  start: number;
  stop: number;
  used_mode: string;
  used_profile: string;
  used_restriction?: string;
  seen_restriction?: string;
}

export type ScheduledTrain = {
  id: number;
  labels: string[];
  name: string;
  path: number;
  departure: number;
  arrival: number;
  speed_limit_tags?: string;
  isFiltered?: boolean;
};

export const enum SPEED_SPACE_SETTINGS {
  altitude = 'altitude',
  curves = 'curves',
  maxSpeed = 'maxSpeed',
  slopes = 'slopes',
  electricalProfiles = 'electricalProfiles',
}

export type ISpeedSpaceSettings = {
  [key in SPEED_SPACE_SETTINGS]: boolean;
};

interface GradientPosition {
  gradient: number;
  position: number;
}

interface RadiusPosition {
  radius: number;
  position: number;
}

export interface SpeedPosition {
  speed: number;
  position: number;
}

export interface Train {
  electrification_conditions: ElectrificationConditions[];
  id: number;
  labels: string[];
  path: number;
  name: string;
  vmax: SpeedPosition[];
  slopes: GradientPosition[];
  curves: RadiusPosition[];
  base: Regime;
  eco: Regime;
  margins: Regime;
  isStdcm?: boolean;
  speed_limit_tags?: string;
}

export interface SimulationSnapshot {
  trains: Train[];
}

export type SimulationHistory = SimulationSnapshot[];

export interface PositionValues {
  headPosition: PositionSpeedTime;
  tailPosition: PositionSpeedTime;
  speed: {
    speed: number;
    time: number;
  };
}

export interface SimulationTrain<DateType = Date> {
  id: number;
  isStdcm?: boolean;
  name: string;
  trainNumber: number;
  headPosition: ConsolidatedPosition<DateType>[][];
  tailPosition: ConsolidatedPosition<DateType>[][];
  routeAspects: ConsolidatedRouteAspect<DateType>[];
  signalAspects: ConsolidatedSignalAspect[];
  areaBlock?: ConsolidatedMergeDataPoint[][];
  speed: ConsolidatePositionSpeed<DateType>[];
  eco_headPosition?: ConsolidatedPosition<DateType>[][];
  eco_tailPosition?: ConsolidatedPosition<DateType>[][];
  eco_routeAspects?: ConsolidatedRouteAspect<DateType>[];
  eco_signalAspects?: ConsolidatedSignalAspect[];
  eco_areaBlock?: ConsolidatedMergeDataPoint[][];
  eco_speed?: ConsolidatePositionSpeed<DateType>[];
}

export interface OsrdSimulationState {
  redirectToGraph?: boolean;
  chart?: Chart;
  chartXGEV?: Chart['x'];
  contextMenu?: {
    id: unknown;
    xPos: unknown;
    yPos: unknown;
  };
  isPlaying: boolean;
  isUpdating: boolean;
  allowancesSettings?: AllowancesSettings;
  mustRedraw: boolean;
  positionValues: PositionValues;
  selectedProjection?: {
    id: unknown;
    path: unknown;
  };
  selectedTrain: number;
  speedSpaceSettings: ISpeedSpaceSettings;
  signalBase: typeof SIGNAL_BASE_DEFAULT;
  timePosition: TimeString;
  consolidatedSimulation: SimulationTrain[];
  departureArrivalTimes: Array<ScheduledTrain>;
  simulation: {
    past: SimulationHistory;
    present: SimulationSnapshot;
    future: SimulationHistory;
  };
  displaySimulation: boolean;
}
