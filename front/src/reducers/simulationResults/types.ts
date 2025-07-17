import type { ScaleTime, ScaleLinear } from 'd3-scale';

import type { PacedTrainId, TrainId, TrainScheduleId } from 'reducers/osrdconf/types';

type SimulationD3Scale = ScaleTime<number, number> | ScaleLinear<number, number>;

export interface Chart {
  width: number;
  height: number;
  x: SimulationD3Scale;
  y: SimulationD3Scale;
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

export type ProjectionType = 'trackProjection' | 'operationalPointProjection';

export type TrainUsedForProjection =
  | {
      id: TrainScheduleId;
    }
  | {
      id: PacedTrainId;
      exceptionKey?: string;
    };

export interface SimulationResultsState {
  chart?: Chart;
  selectedTrainId?: TrainId;
  trainUsedForProjection?: TrainUsedForProjection;
  projectionType: ProjectionType;
}
