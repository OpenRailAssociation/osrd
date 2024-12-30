import { beforeEach, it, expect } from 'vitest';

import {
  operationalStudiesConfSlice,
  operationalStudiesInitialConf,
  type OperationalStudiesConfState,
} from 'reducers/osrdconf/operationalStudiesConf';
import commonConfBuilder from 'reducers/osrdconf/osrdConfCommon/__tests__/commonConfBuilder';
import { createStoreWithoutMiddleware } from 'store';

const createStore = (extraInitialState?: Partial<OperationalStudiesConfState>) =>
  createStoreWithoutMiddleware({
    [operationalStudiesConfSlice.name]: {
      ...operationalStudiesInitialConf,
      ...extraInitialState,
    },
  });

const testItineraryReducer = () => {
  let defaultStore: ReturnType<typeof createStore>;
  const testDataBuilder = commonConfBuilder();
  const slice = operationalStudiesConfSlice;
  const { updatePathSteps, deleteItinerary } = slice.actions;

  const getState = () => defaultStore.getState()[operationalStudiesConfSlice.name];

  beforeEach(() => {
    defaultStore = createStore();
  });

  it('should handle updatePathSteps', () => {
    const pathSteps = testDataBuilder.buildPathSteps();
    defaultStore.dispatch(updatePathSteps(pathSteps));
    const state = getState();
    expect(state.pathSteps).toEqual(pathSteps);
  });

  it('should handle deleteItinerary', () => {
    const pathSteps = testDataBuilder.buildPathSteps();
    const store = createStore({ pathSteps });
    store.dispatch(deleteItinerary());
    const state = getState();
    expect(state.pathSteps).toEqual([null, null]);
  });
};

export default testItineraryReducer;
