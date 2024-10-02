import type { InvalidReason } from './types';

export const specialCodeDictionary: { [key: string]: string } = {
  '': 'NO CODE',
};

export const invalidTrainValues: {
  [key in InvalidReason]: InvalidReason;
} = {
  pathfinding_not_found: 'pathfinding_not_found',
  pathfinding_failure: 'pathfinding_failure',
  pathfinding_input_error: 'pathfinding_input_error',
  simulation_failed: 'simulation_failed',
};
