import { describe, expect } from 'vitest';
import { createStoreWithoutMiddleware } from 'store';

import { defaultCommonConf } from 'reducers/osrdconf/osrdConfCommon';
import testCommonConfReducers from 'reducers/osrdconf/osrdConfCommon/__tests__/utils';
import { operationalStudiesConfSlice } from 'reducers/osrdconf/operationalStudiesConf';

const createStore = () =>
  createStoreWithoutMiddleware({
    [operationalStudiesConfSlice.name]: {
      ...defaultCommonConf,
    },
  });

describe('simulationConfReducer', () => {
  it('should return initial state', () => {
    const store = createStore();
    const state = store.getState()[operationalStudiesConfSlice.name];
    expect(state).toEqual(defaultCommonConf);
  });

  testCommonConfReducers(operationalStudiesConfSlice);
});
