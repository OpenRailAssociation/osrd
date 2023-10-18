import {
  OsrdStdcmConfState,
  StandardAllowance,
  STDCM_MODES,
} from 'applications/operationalStudies/consts';
import { createStoreWithoutMiddleware } from 'Store';

import { describe, expect } from 'vitest';
import { stdcmConfInitialState, stdcmConfSlice, stdcmConfSliceActions } from '.';
import testCommonConfReducers from '../common/tests/utils';

const createStore = (initialStateExtra?: Partial<OsrdStdcmConfState>) =>
  createStoreWithoutMiddleware({
    [stdcmConfSlice.name]: {
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
    const state = store.getState()[stdcmConfSlice.name];
    expect(state).toEqual(stdcmConfInitialState);
  });

  it('should handle updateMaximumRunTime', () => {
    const store = createStore();
    const newMaximumRunTime = 10;
    store.dispatch(stdcmConfSliceActions.updateMaximumRunTime(newMaximumRunTime));

    const state = store.getState()[stdcmConfSlice.name];
    expect(state.maximumRunTime).toBe(newMaximumRunTime);
  });

  it('should handle updateStdcmMode', () => {
    const store = createStore({
      stdcmMode: STDCM_MODES.byDestination,
    });

    const stateBefore = store.getState()[stdcmConfSlice.name];
    expect(stateBefore.stdcmMode).toBe(STDCM_MODES.byDestination);

    const newStdcmMode = STDCM_MODES.byOrigin;
    store.dispatch(stdcmConfSliceActions.updateStdcmMode(newStdcmMode));

    const stateAfter = store.getState()[stdcmConfSlice.name];
    expect(stateAfter.stdcmMode).toBe(newStdcmMode);
  });

  it('should handle updateStdcmStandardAllowance', () => {
    const initialTimeStandardAllowance = testDataBuilder.buildTimeStandardAllowance(10);
    const store = createStore({
      standardStdcmAllowance: initialTimeStandardAllowance,
    });

    const stateBefore = store.getState()[stdcmConfSlice.name];
    expect(stateBefore.standardStdcmAllowance).toBe(initialTimeStandardAllowance);

    const newStandardAllowance = testDataBuilder.buildPercentageStandardAllowance(5);
    store.dispatch(stdcmConfSliceActions.updateStdcmStandardAllowance(newStandardAllowance));

    const stateAfter = store.getState()[stdcmConfSlice.name];
    expect(stateAfter.standardStdcmAllowance).toBe(newStandardAllowance);
  });

  testCommonConfReducers(stdcmConfSlice);
});
