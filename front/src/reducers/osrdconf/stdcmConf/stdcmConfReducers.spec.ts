import { describe, expect } from 'vitest';

import {
  stdcmConfInitialState,
  stdcmConfSlice,
  stdcmConfSliceActions,
} from 'reducers/osrdconf/stdcmConf';
import type { OsrdStdcmConfState, StandardAllowance } from 'reducers/osrdconf/types';
import { createStoreWithoutMiddleware } from 'store';

import commonConfBuilder from '../osrdConfCommon/__tests__/commonConfBuilder';
import testCommonConfReducers from '../osrdConfCommon/__tests__/utils';

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

const testDataBuilder = {
  ...stdcmConfTestDataBuilder(),
  ...commonConfBuilder(),
};

const [brest, rennes, lemans, paris] = testDataBuilder.buildPathSteps();

const initialStateSTDCMConfig = {
  rollingStockID: 10,
  pathSteps: [paris, lemans, rennes, brest],
  originDate: '2024-07-24',
  originTime: '12:00',
  speedLimitByTag: 'init-tag',
};

describe('stdcmConfReducers', () => {
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

  it('should handle resetStdcmConfig', () => {
    const store = createStore(initialStateSTDCMConfig);
    store.dispatch(stdcmConfSliceActions.resetStdcmConfig());

    const state = store.getState()[stdcmConfSlice.name];
    expect(state.rollingStockID).toBe(stdcmConfInitialState.rollingStockID);
    expect(state.pathSteps).toBe(stdcmConfInitialState.pathSteps);
    expect(state.originDate).toBe(stdcmConfInitialState.originDate);
    expect(state.originTime).toBe(stdcmConfInitialState.originTime);
    expect(state.speedLimitByTag).toBe(stdcmConfInitialState.speedLimitByTag);
  });

  it('should handle updateStdcmConfigWithData', () => {
    const store = createStore(initialStateSTDCMConfig);
    store.dispatch(
      stdcmConfSliceActions.updateStdcmConfigWithData({
        rollingStockID: 20,
        pathSteps: [paris, rennes],
        originDate: '2024-07-25',
        originTime: '13:00',
        speedLimitByTag: 'new-tag',
      })
    );

    const state = store.getState()[stdcmConfSlice.name];
    expect(state.rollingStockID).toBe(20);
    expect(state.pathSteps).toEqual([paris, rennes]);
    expect(state.originDate).toBe('2024-07-25');
    expect(state.originTime).toBe('13:00');
    expect(state.speedLimitByTag).toBe('new-tag');
  });

  testCommonConfReducers(stdcmConfSlice);
});
