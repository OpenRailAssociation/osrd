import type { InvalidReason } from './types';

export const specialCodeDictionary: { [key: string]: string } = {
  '': 'NO CODE',
};

export const invalidTrainValues: {
  [key in InvalidReason]: InvalidReason;
} = {
  pathfinding_failure: 'pathfinding_failure',
  simulation_failed: 'simulation_failed',
  not_found_in_blocks: 'not_found_in_blocks',
  not_found_in_routes: 'not_found_in_routes',
  not_found_in_tracks: 'not_found_in_tracks',
  incompatible_constraints: 'incompatible_constraints',
  rolling_stock_not_found: 'rolling_stock_not_found',
  not_enough_path_items: 'not_enough_path_items',
  invalid_path_items: 'invalid_path_items',
};
