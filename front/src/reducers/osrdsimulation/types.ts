import * as d3 from 'd3';
import { AllListValues, SIGNAL_BASE_DEFAULT } from 'modules/simulationResult/consts';
import {
  ElectrificationRange,
  PowerRestrictionRangeItem,
  SimulationReport,
  TrainScheduleSummary,
} from 'common/api/osrdEditoastApi';

export type MergedDataPoint<T = number> = {
  [key: string]: number | T;
  value0: number | T;
  value1: number | T;
};
export type ConsolidatedMergeDataPoint = MergedDataPoint<Date | null>;

export type SimulationD3Scale = d3.ScaleTime<number, number> | d3.ScaleLinear<number, number>;

export interface SpeedSpaceChart extends Chart {
  x: d3.ScaleLinear<number, number>;
  y: d3.ScaleLinear<number, number>;
  y2: d3.ScaleLinear<number, number>;
  originalScaleX?: d3.ScaleLinear<number, number>;
  originalScaleY?: d3.ScaleLinear<number, number>;
  originalScaleY2?: d3.ScaleLinear<number, number>;
}
export interface Chart {
  width: number;
  height: number;
  margin: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  x: SimulationD3Scale;
  xAxis: d3.Selection<SVGGElement, unknown, null, undefined>;
  xAxisGrid: d3.Selection<SVGGElement, unknown, null, undefined>;
  y: SimulationD3Scale;
  yAxis: d3.Selection<SVGGElement, unknown, null, undefined>;
  yAxisGrid: d3.Selection<SVGGElement, unknown, null, undefined>;
  y2?: SimulationD3Scale;
  y2Axis?: d3.Selection<SVGGElement, unknown, null, undefined>;
  y2AxisGrid?: d3.Selection<SVGGElement, unknown, null, undefined>;
  svg: d3.Selection<SVGGElement, unknown, null, undefined>;
  drawZone: d3.Selection<SVGGElement, unknown, null, undefined>;
  originalScaleX?: SimulationD3Scale;
  originalScaleY?: SimulationD3Scale;
  originalScaleY2?: SimulationD3Scale;
  rotate?: boolean;
}
export interface AllowancesSetting {
  base: boolean;
  baseBlocks: boolean;
  eco: boolean;
  ecoBlocks: boolean;
}

export type AllowancesSettings = Record<string | number, AllowancesSetting>;
export type Projection = {
  id: number;
  path: number;
};

export interface Position<Time = number> {
  time: Time;
  position: number;
}
export type ConsolidatedPosition<DateType = Date> = Position<DateType | null>;

export type PositionSpeedTime<Time = number> = Position<Time> & {
  speed: number;
};
export type ConsolidatedPositionSpeedTime = PositionSpeedTime<Date>;

export interface Stop {
  id: string | null;
  name: string | null;
  time: number;
  duration: number;
  position: number;
  line_code: number | null;
  track_number: number | null;
  line_name: string | null;
  track_name: string | null;
  ch?: string | null;
}

export interface RouteAspect<Time = number, Color = number> {
  signal_id?: string;
  route_id?: string;
  time_start: Time;
  time_end: Time;
  position_start: number;
  position_end: number;
  color: Color;
  blinking: boolean;
  aspect_label?: string;
  track?: string;
  track_offset?: number;
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

export type MechanicalEnergyConsumedBaseEco = {
  base?: number;
  eco?: number | null;
};

export type ScheduledTrain = TrainScheduleSummary & {
  duration?: number;
};

export interface GradientPosition {
  gradient: number;
  position: number;
}

export interface RadiusPosition {
  radius: number;
  position: number;
}

export interface SpeedPosition {
  speed: number;
  position: number;
}

export interface HeightPosition {
  height: number;
  position: number;
}

export interface SpeedTime<Time = number> {
  speed: number;
  time: Time;
}

export type ConsolidatedSpeedTime = SpeedTime<Date>;

export interface Train {
  electrification_ranges: ElectrificationRange[];
  power_restriction_ranges: PowerRestrictionRangeItem[];
  id: number;
  labels: string[];
  path: number;
  pathLength?: number;
  name: string;
  vmax: SpeedPosition[];
  slopes: GradientPosition[];
  curves: RadiusPosition[];
  base: Regime;
  eco?: Regime;
  margins?: Regime;
  stopsCount?: number;
  isStdcm?: boolean;
  mechanicalEnergyConsumed?: MechanicalEnergyConsumedBaseEco;
  speed_limit_tags?: string;
}

export interface SimulationSnapshot {
  trains: Train[] | SimulationReport[];
}

export type SimulationHistory = SimulationSnapshot[];

export type PositionsSpeedTimes<Time = number> = Record<AllListValues, PositionSpeedTime<Time>>;

export interface SimulationTrain<DateType = Date> {
  id: number;
  isStdcm?: boolean;
  name: string;
  headPosition: ConsolidatedPosition<DateType>[][];
  tailPosition: ConsolidatedPosition<DateType>[][];
  routeAspects: ConsolidatedRouteAspect<DateType>[];
  signalAspects: ConsolidatedSignalAspect[];
  areaBlock?: ConsolidatedMergeDataPoint[][];
  speed: ConsolidatedPositionSpeedTime[];
  eco_headPosition?: ConsolidatedPosition<DateType>[][];
  eco_tailPosition?: ConsolidatedPosition<DateType>[][];
  eco_routeAspects?: ConsolidatedRouteAspect<DateType>[];
  eco_signalAspects?: ConsolidatedSignalAspect[];
  eco_areaBlock?: ConsolidatedMergeDataPoint[][];
  eco_speed?: ConsolidatedPositionSpeedTime[];
}

export enum SPEED_SPACE_SETTINGS_KEYS {
  ALTITUDE = 'altitude',
  CURVES = 'curves',
  MAX_SPEED = 'maxSpeed',
  SLOPES = 'slopes',
  ELECTRICAL_PROFILES = 'electricalProfiles',
  POWER_RESTRICTION = 'powerRestriction',
}
export type SpeedSpaceSettingKey =
  | SPEED_SPACE_SETTINGS_KEYS.ALTITUDE
  | SPEED_SPACE_SETTINGS_KEYS.CURVES
  | SPEED_SPACE_SETTINGS_KEYS.MAX_SPEED
  | SPEED_SPACE_SETTINGS_KEYS.SLOPES
  | SPEED_SPACE_SETTINGS_KEYS.ELECTRICAL_PROFILES
  | SPEED_SPACE_SETTINGS_KEYS.POWER_RESTRICTION;

export type SpeedSpaceSettingsType = { [key in SpeedSpaceSettingKey]: boolean };

export interface OsrdSimulationState {
  redirectToGraph?: boolean;
  chart?: Chart;
  chartXGEV?: Chart['x'];
  isPlaying: boolean;
  isUpdating: boolean;
  allowancesSettings?: AllowancesSettings;
  mustRedraw: boolean;
  selectedProjection?: Projection;
  selectedTrainId?: number;
  speedSpaceSettings: {
    [key in SpeedSpaceSettingKey]: boolean;
  };
  signalBase: typeof SIGNAL_BASE_DEFAULT;
  consolidatedSimulation: SimulationTrain[];
  simulation: {
    past: SimulationHistory;
    present: SimulationSnapshot;
    future: SimulationHistory;
  };
}
