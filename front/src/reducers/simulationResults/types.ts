import type { AllListValues } from 'modules/simulationResult/consts';

type SimulationD3Scale = d3.ScaleTime<number, number> | d3.ScaleLinear<number, number>;

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

interface Position<Time = number> {
  time: Time;
  position: number;
}

export type PositionSpeedTime<Time = number> = Position<Time> & {
  speed: number;
};

export type SpeedRanges = {
  // List of `n` internal boundaries of the ranges along the path in m (excluding start and end bounds).
  internalBoundaries: number[];
  // List of `n+1` speeds associated to the bounded intervals in m/s
  speeds: number[];
};

interface Stop {
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

interface RouteAspect<Time = number, Color = number> {
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

interface SignalAspect<Time = number, Color = number> {
  signal_id: string;
  time_start: Time;
  time_end: Time;
  color: Color;
  blinking: boolean;
  aspect_label: string;
}

interface Regime {
  head_positions: Position[][];
  tail_positions: Position[][];
  speeds: PositionSpeedTime[];
  stops: Stop[];
  route_aspects: RouteAspect[];
  signal_aspects?: SignalAspect[];
  error?: string;
  mechanical_energy_consumed: number;
}

type MechanicalEnergyConsumedBaseEco = {
  base?: number;
  eco?: number | null;
};

interface GradientPosition {
  gradient: number;
  position: number;
}

interface RadiusPosition {
  radius: number;
  position: number;
}

interface SpeedPosition {
  speed: number;
  position: number;
}

export interface Train {
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
  mechanicalEnergyConsumed?: MechanicalEnergyConsumedBaseEco;
  speed_limit_tags?: string;
}

export type PositionsSpeedTimes<Time = number> = Record<AllListValues, PositionSpeedTime<Time>>;

export interface SimulationResultsState {
  chart?: Chart;
  isPlaying: boolean;
  selectedTrainId?: number;
  trainIdUsedForProjection?: number;
}
