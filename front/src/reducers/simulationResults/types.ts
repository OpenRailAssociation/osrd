import type { ScaleTime, ScaleLinear } from 'd3-scale';

import type { OccurrenceId, PacedTrainId, TrainId, TrainScheduleId } from 'reducers/osrdconf/types';

type SimulationD3Scale = ScaleTime<number, number> | ScaleLinear<number, number>;

export type Chart = {
  width: number;
  height: number;
  x: SimulationD3Scale;
  y: SimulationD3Scale;
  rotate?: boolean;
};

type Position<Time = number> = {
  time: Time;
  position: number;
};

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

export type SimulationResultsState = {
  chart?: Chart;
  selectedTrainId?: TrainId;
  trainIdUsedForProjection?: TrainScheduleId | PacedTrainId | OccurrenceId;
  projectionType: ProjectionType;
  displayOnlyPathSteps: boolean;
};
