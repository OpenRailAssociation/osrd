import * as d3 from 'd3';
import { TimeString } from 'common/types';
import { SIGNAL_BASE_DEFAULT } from '../../applications/osrd/components/Simulation/consts';

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
export type ConsolidatedPosition = Position<Date | null>;

export type PositionSpeed<Time = number> = Position<Time> & {
  speed: number;
};
export type ConsolidatePositionSpeed = PositionSpeed<Date | null>;

interface Stop {
  id: number;
  name: string;
  time: number;
  duration: number;
  position: number;
  line_code: number;
  track_number: number;
}

export interface RouteAspect<Time = number, Color = number> {
  signal_id: string;
  route_id: string;
  time_start: Time;
  time_end: Time;
  position_start: number;
  position_end: number;
  color: Color;
  blinking: boolean;
}
export type ConsolidatedRouteAspect = RouteAspect<Date | null, string>;

export interface SignalAspect<Time = number, Color = number> {
  signal_id: string;
  time_start: Time;
  time_end: Time;
  color: Color;
  blinking: boolean;
  aspect_label: string;
}
export type ConsolidatedSignalAspect = SignalAspect<Date | null, string>;

export interface Regime {
  head_positions: Position[][];
  tail_positions: Position[][];
  route_begin_occupancy: Position[][];
  route_end_occupancy: Position[][];
  speeds: PositionSpeed[];
  stops: Stop[];
  route_aspects: RouteAspect[];
  signal_aspects: SignalAspect[];
  error: any;
}

export interface Train {
  id: number;
  labels: any[];
  path: number;
  name: string;
  vmax: any[];
  slopes: any[];
  curves: any[];
  base: Regime;
  eco: Regime;
  margins: Regime;
  isStdcm: boolean;
  speed_limit_composition: string;
}

export interface SimulationSnapshot {
  trains: Train[];
}

export type SimulationHistory = SimulationSnapshot[];

export interface PositionValues {
  headPosition: PositionSpeed;
  tailPosition: PositionSpeed;
  speed: {
    speed: number;
    time: number;
  };
}

export interface SimulationTrain {
  id: number;
  isStdcm: boolean;
  name: string;
  trainNumber: number;
  headPosition: ConsolidatedPosition[][];
  tailPosition: ConsolidatedPosition[][];
  routeAspects: ConsolidatedRouteAspect[];
  signalAspects: ConsolidatedSignalAspect[];
  areaBlock?: ConsolidatedMergeDataPoint[][];
  speed: ConsolidatePositionSpeed[];
  eco_headPosition?: ConsolidatedPosition[][];
  eco_tailPosition?: ConsolidatedPosition[][];
  eco_routeAspects?: ConsolidatedRouteAspect[];
  eco_signalAspects?: ConsolidatedSignalAspect[];
  eco_areaBlock?: ConsolidatedMergeDataPoint[][];
  eco_speed?: ConsolidatePositionSpeed[];
}

export interface OsrdSimulationState {
  redirectToGraph?: boolean;
  chart: any;
  chartXGEV: any;
  contextMenu: any;
  hoverPosition: any;
  isPlaying: boolean;
  allowancesSettings?: AllowancesSettings;
  mustRedraw: boolean;
  positionValues: PositionValues;
  selectedProjection: any;
  selectedTrain: number;
  speedSpaceSettings: {
    altitude: boolean;
    curves: boolean;
    maxSpeed: boolean;
    slopes: boolean;
  };
  stickyBar: boolean;
  signalBase: typeof SIGNAL_BASE_DEFAULT;
  timePosition: TimeString;
  consolidatedSimulation: SimulationTrain[];
  departureArrivalTimes: Array<any>;
  simulation: {
    past: SimulationHistory;
    present: SimulationSnapshot;
    future: SimulationHistory;
  };
  displaySimulation: boolean;
}
