import { describe, it, expect } from 'vitest';

import type { OccurrenceId, PacedTrainId } from 'reducers/osrdconf/types';
import { createStoreWithoutMiddleware } from 'store';

import {
  simulationResultsInitialState,
  simulationResultsSlice,
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

  it('should handle updateSelectedTrainId with a paced train', () => {
    const store = createStore();
    store.dispatch(updateSelectedTrainId('paced_1' as PacedTrainId));

    const state = store.getState()[simulationResultsSlice.name];
    expect(state.selectedTrain).toEqual({ id: 'paced_1', by: 'timetable' });
  });

  it('should handle updateSelectedTrainId with a paced train occurrence', () => {
    const store = createStore();
    store.dispatch(updateSelectedTrainId('paced-1-occurrence-2' as OccurrenceId));

    const state = store.getState()[simulationResultsSlice.name];
    expect(state.selectedTrain).toEqual({ id: 'paced-1-occurrence-2', by: 'timetable' });
  });

  it('should handle updateTrainIdUsedForProjection with a paced train', () => {
    const store = createStore();
    store.dispatch(updateTrainIdUsedForProjection('paced-1' as PacedTrainId));

    const state = store.getState()[simulationResultsSlice.name];
    expect(state.trainIdUsedForProjection).toBe('paced-1');
  });

  it('should handle updateProjectionType', () => {
    const store = createStore();
    const newProjectionType = 'operationalPointProjection';
    store.dispatch(simulationResultsSlice.actions.updateProjectionType(newProjectionType));

    const state = store.getState()[simulationResultsSlice.name];
    expect(state.projectionType).toBe(newProjectionType);
  });
});
