import { OsrdConfState } from 'applications/operationalStudies/consts';
import { createStoreWithoutMiddleware } from 'Store';

import { describe, expect } from 'vitest';
import { simulationConfInitialState, simulationConfSlice } from '.';
import testCommonReducers from '../common/testUtils';

const createStore = (initialStateExtra?: OsrdConfState) =>
  createStoreWithoutMiddleware({
    simulationconf: initialStateExtra,
  });

describe('simulationConfReducer', () => {
  it('should return initial state', () => {
    const store = createStore();
    const state = store.getState().simulationconf;
    expect(state).toEqual(simulationConfInitialState);
  });

  testCommonReducers(simulationConfSlice);
});
