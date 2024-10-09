import { describe, it, expect } from 'vitest';

import { createStoreWithoutMiddleware } from 'store';

import {
  simulationResultsInitialState,
  simulationResultsSlice,
  updateIsPlaying,
  updateSelectedTrainId,
  updateTrainIdUsedForProjection,
} from '.';
import type { SimulationResultsState } from './types';

const createStore = (initialStateExtra?: Partial<SimulationResultsState>) =>
  createStoreWithoutMiddleware({
    [simulationResultsSlice.name]: {
      ...simulationResultsInitialState,
      ...initialStateExtra,
    },
  });

describe('simulationResultsReducer', () => {
  it('should return initial state', () => {
    const store = createStore();
    const state = store.getState()[simulationResultsSlice.name];
    expect(state).toEqual(simulationResultsInitialState);
  });

  it('should handle updateIsPlaying', () => {
    const store = createStore();
    store.dispatch(updateIsPlaying(true));

    const state = store.getState()[simulationResultsSlice.name];
    expect(state.isPlaying).toBe(true);
  });

  it('should handle updateSelectedTrainId', () => {
    const store = createStore();
    store.dispatch(updateSelectedTrainId(1));

    const state = store.getState()[simulationResultsSlice.name];
    expect(state.selectedTrainId).toBe(1);
  });

  it('should handle updateTrainIdUsedForProjection', () => {
    const store = createStore();
    store.dispatch(updateTrainIdUsedForProjection(1));

    const state = store.getState()[simulationResultsSlice.name];
    expect(state.trainIdUsedForProjection).toBe(1);
  });
});
