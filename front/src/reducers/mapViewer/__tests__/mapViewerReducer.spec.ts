import { describe, beforeEach, it, expect } from 'vitest';

import { mapViewerInitialState, mapViewerSlice, mapViewerSliceActions } from 'reducers/mapViewer';
import { createStoreWithoutMiddleware } from 'store';

const createStore = () =>
  createStoreWithoutMiddleware({
    [mapViewerSlice.name]: mapViewerInitialState,
  });
let store: ReturnType<typeof createStore>;

beforeEach(() => {
  store = createStore();
});

const { updateInfraID } = mapViewerSliceActions;

describe('mapViewerReducer', () => {
  it('should return initial state', () => {
    const mapViewerState = store.getState()[mapViewerSlice.name];
    expect(mapViewerState).toEqual(mapViewerInitialState);
  });

  it('should handle updateInfraID', () => {
    store.dispatch(updateInfraID(8));
    const mapViewerState = store.getState()[mapViewerSlice.name];
    expect(mapViewerState.infraID).toEqual(8);
  });
});
