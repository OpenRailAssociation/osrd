import { OsrdConfState } from 'applications/operationalStudies/consts';
import { createStoreWithoutMiddleware } from 'Store';

import { describe, expect } from 'vitest';
import { simulationConfInitialState, simulationConfSlice } from '.';
import testCommonConfReducers from '../common/tests/utils';

const createStore = (initialStateExtra?: OsrdConfState) =>
  createStoreWithoutMiddleware({
    [simulationConfSlice.name]: initialStateExtra,
  });

describe('simulationConfReducer', () => {
  it('should return initial state', () => {
    const store = createStore();
    const state = store.getState()[simulationConfSlice.name];
    expect(state).toEqual(simulationConfInitialState);
  });

  testCommonConfReducers(simulationConfSlice);
});
