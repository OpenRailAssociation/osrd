import type { PathfindingState } from './types';

// eslint-disable-next-line import/prefer-default-export
export const initialState: PathfindingState = {
  running: false,
  done: false,
  error: '',
  missingParam: false,
  mustBeLaunched: false,
  mustBeLaunchedManually: false,
  cancelled: false,
};
