import { describe, beforeEach, it, expect } from 'vitest';

import {
  referenceMapInitialState,
  referenceMapSlice,
  referenceMapSliceActions,
} from 'reducers/referenceMap';
import { createStoreWithoutMiddleware } from 'store';

const createStore = () =>
  createStoreWithoutMiddleware({
    [referenceMapSlice.name]: referenceMapInitialState,
  });
let store: ReturnType<typeof createStore>;

beforeEach(() => {
  store = createStore();
});

const { updateInfraID } = referenceMapSliceActions;

describe('referenceMapReducer', () => {
  it('should return initial state', () => {
    const referenceMapState = store.getState()[referenceMapSlice.name];
    expect(referenceMapState).toEqual(referenceMapInitialState);
  });

  it('should handle updateInfraID', () => {
    store.dispatch(updateInfraID(8));
    const referenceMapState = store.getState()[referenceMapSlice.name];
    expect(referenceMapState.infraID).toEqual(8);
  });
});
