import type { ScaleTime, ScaleLinear } from 'd3-scale';
import type { Selection } from 'd3-selection';

import type { TimetableItemId, TrainId } from 'reducers/osrdconf/types';

type SimulationD3Scale = ScaleTime<number, number> | ScaleLinear<number, number>;

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
  xAxis: Selection<SVGGElement, unknown, null, undefined>;
  xAxisGrid: Selection<SVGGElement, unknown, null, undefined>;
  y: SimulationD3Scale;
  yAxis: Selection<SVGGElement, unknown, null, undefined>;
  yAxisGrid: Selection<SVGGElement, unknown, null, undefined>;
  y2?: SimulationD3Scale;
  y2Axis?: Selection<SVGGElement, unknown, null, undefined>;
  y2AxisGrid?: Selection<SVGGElement, unknown, null, undefined>;
  svg: Selection<SVGGElement, unknown, null, undefined>;
  drawZone: Selection<SVGGElement, unknown, null, undefined>;
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
