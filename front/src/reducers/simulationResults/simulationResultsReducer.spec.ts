import { describe, it, expect } from 'vitest';

import type { OccurrenceId, TrainScheduleId } from 'reducers/osrdconf/types';
import { createStoreWithoutMiddleware } from 'store';

import {
  simulationResultsInitialState,
  simulationResultsSlice,
  updateSelectedTrain,
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

  it('should handle updateSelectedTrain with a paced train', () => {
    const store = createStore();
    store.dispatch(
      updateSelectedTrain({ id: 'trainSchedule_1' as TrainScheduleId, by: 'timetable' })
    );

    const state = store.getState()[simulationResultsSlice.name];
    expect(state.selectedTrain).toEqual({ id: 'trainSchedule_1', by: 'timetable' });
  });

  it('should handle updateSelectedTrain with a paced train occurrence on the space time diagram (STD)', () => {
    const store = createStore();
    store.dispatch(updateSelectedTrain({ id: 'paced-1-occurrence-2' as OccurrenceId, by: 'std' }));

    const state = store.getState()[simulationResultsSlice.name];
    expect(state.selectedTrain).toEqual({ id: 'paced-1-occurrence-2', by: 'std' });
  });

  it('should handle updateTrainIdUsedForProjection with a paced train', () => {
    const store = createStore();
    store.dispatch(updateTrainIdUsedForProjection('paced-1' as TrainScheduleId));

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
