import type { InvalidReason } from './types';

export const specialCodeDictionary: { [key: string]: string } = {
  '': 'NO CODE',
};

export const invalidTrainValues: {
  [key in InvalidReason]: InvalidReason;
} = {
  pathfinding_not_found: 'pathfinding_not_found',
  pathfinding_failed: 'pathfinding_failed',
  rolling_stock_not_found: 'rolling_stock_not_found',
  simulation_failed: 'simulation_failed',
};
