import type { TimetableItemId, TrainId } from 'reducers/osrdconf/types';

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

export interface SimulationResultsState {
  chart?: Chart;
  selectedTrainId?: TrainId;
  trainIdUsedForProjection?: TimetableItemId;
}
