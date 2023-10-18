import {
  OsrdStdcmConfState,
  StandardAllowance,
  STDCM_MODES,
} from 'applications/operationalStudies/consts';
import { createStoreWithoutMiddleware } from 'Store';

import { describe, expect } from 'vitest';
import { stdcmConfInitialState, stdcmConfSlice, stdcmConfSliceActions } from '.';
import testCommonReducers from '../common/testUtils';

const createStore = (initialStateExtra?: Partial<OsrdStdcmConfState>) =>
  createStoreWithoutMiddleware({
    simulationconf: {
      ...stdcmConfInitialState,
      ...initialStateExtra,
    },
  });

function stdcmConfTestDataBuilder() {
  return {
    buildPercentageStandardAllowance: (value: number): StandardAllowance => ({
      value,
      type: 'percentage',
    }),
    buildTimeStandardAllowance: (value: number): StandardAllowance => ({
      value,
      type: 'time',
    }),
  };
}

describe('stdcmConfReducers', () => {
  const testDataBuilder = stdcmConfTestDataBuilder();

  it('should return initial state', () => {
    const store = createStore();
    const state = store.getState().stdcmconf;
    expect(state).toEqual(stdcmConfInitialState);
  });

  it('should handle updateMaximumRunTime', () => {
    const store = createStore();
    const newMaximumRunTime = 10;
    store.dispatch(stdcmConfSliceActions.updateMaximumRunTime(newMaximumRunTime));

    const state = store.getState().stdcmconf;
    expect(state.maximumRunTime).toBe(newMaximumRunTime);
  });

  it('should handle updateStdcmMode', () => {
    const store = createStore({
      stdcmMode: STDCM_MODES.byDestination,
    });
    const newStdcmMode = STDCM_MODES.byOrigin;
    store.dispatch(stdcmConfSliceActions.updateStdcmMode(newStdcmMode));

    const state = store.getState().stdcmconf;
    expect(state.stdcmMode).toBe(newStdcmMode);
  });

  it('should handle updateStdcmStandardAllowance', () => {
    const store = createStore({
      standardStdcmAllowance: testDataBuilder.buildTimeStandardAllowance(10),
    });
    const newStdcmMode = testDataBuilder.buildPercentageStandardAllowance(5);
    store.dispatch(stdcmConfSliceActions.updateStdcmStandardAllowance(newStdcmMode));

    const state = store.getState().stdcmconf;
    expect(state.standardStdcmAllowance).toBe(newStdcmMode);
  });

  testCommonReducers(stdcmConfSlice);
});
