import { describe, it, expect } from 'vitest';

import { ArrivalTimeTypes, StdcmStopTypes } from 'applications/stdcm/types';
import {
  stdcmConfInitialState,
  stdcmConfSlice,
  stdcmConfSliceActions,
} from 'reducers/osrdconf/stdcmConf';
import type { OsrdStdcmConfState, StandardAllowance, StdcmPathStep } from 'reducers/osrdconf/types';
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

const pathSteps = testDataBuilder.buildPathSteps();
const [brest, rennes, lemans, paris] = pathSteps;
const stdcmPathSteps = pathSteps.map(
  (step, index) =>
    ({
      ...step,
      ...(index === 0 || index === pathSteps.length - 1
        ? {
            isVia: false,
            arrivalType: ArrivalTimeTypes.PRECISE_TIME,
          }
        : {
            isVia: true,
            stopType: StdcmStopTypes.PASSAGE_TIME,
          }),
    }) as StdcmPathStep
);

const initialStateSTDCMConfig = {
  rollingStockID: 10,
  pathSteps: [paris, lemans, rennes, brest],
  speedLimitByTag: 'init-tag',
  stdcmPathSteps,
};

describe('stdcmConfReducers', () => {
  it('should return initial state', () => {
    const store = createStore();
    const state = store.getState()[stdcmConfSlice.name];
    expect(state).toEqual(stdcmConfInitialState);
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
    expect(state.stdcmPathSteps).toBe(stdcmConfInitialState.stdcmPathSteps);
    expect(state.speedLimitByTag).toBe(stdcmConfInitialState.speedLimitByTag);
  });

  it('should handle updateStdcmConfigWithData', () => {
    const store = createStore(initialStateSTDCMConfig);
    store.dispatch(
      stdcmConfSliceActions.updateStdcmConfigWithData({
        rollingStockID: 20,
        pathSteps: [paris, rennes],
        speedLimitByTag: 'new-tag',
      })
    );

    const state = store.getState()[stdcmConfSlice.name];
    expect(state.rollingStockID).toBe(20);
    expect(state.pathSteps).toEqual([paris, rennes]);
    expect(state.speedLimitByTag).toBe('new-tag');
  });

  describe('Consist updates', () => {
    const store = createStore();
    it('should handle totalMass', () => {
      store.dispatch(stdcmConfSliceActions.updateTotalMass(345));
      const state = store.getState()[stdcmConfSlice.name];
      expect(state.totalMass).toEqual(345);
    });

    it('should handle totalLength', () => {
      store.dispatch(stdcmConfSliceActions.updateTotalLength(345));
      const state = store.getState()[stdcmConfSlice.name];
      expect(state.totalLength).toEqual(345);
    });
    it('should handle maxSpeed', () => {
      store.dispatch(stdcmConfSliceActions.updateMaxSpeed(110));
      const state = store.getState()[stdcmConfSlice.name];
      expect(state.maxSpeed).toEqual(110);
    });
  });

  describe('StdcmPathStep updates', () => {
    const store = createStore(initialStateSTDCMConfig);

    it('should handle origin update', () => {
      const origin = store.getState()[stdcmConfSlice.name].stdcmPathSteps.at(0)!;
      expect(origin.isVia).toBe(false);
      const newOrigin = {
        ...origin,
        arrivalType: ArrivalTimeTypes.ASAP,
        arrival: '2024-08-12T15:45:00.000+02:00',
        tolerances: {
          before: 60,
          after: 60,
        },
      };

      store.dispatch(stdcmConfSliceActions.updateStdcmPathStep(newOrigin));
      const state = store.getState()[stdcmConfSlice.name];
      expect(state.stdcmPathSteps.at(0)).toEqual(newOrigin);
    });

    it('should handle via update', () => {
      const via = store.getState()[stdcmConfSlice.name].stdcmPathSteps.at(1)!;
      expect(via.isVia).toBe(true);
      const newVia = {
        ...via,
        stopType: StdcmStopTypes.DRIVER_SWITCH,
        stopFor: 'PT60',
      };

      store.dispatch(stdcmConfSliceActions.updateStdcmPathStep(newVia));
      const state = store.getState()[stdcmConfSlice.name];
      expect(state.stdcmPathSteps.at(1)).toEqual(newVia);
    });

    it('should handle destination update', () => {
      const destination = store.getState()[stdcmConfSlice.name].stdcmPathSteps.at(-1)!;
      expect(destination.isVia).toBe(false);
      const newDestination = {
        ...destination,
        arrivalType: ArrivalTimeTypes.ASAP,
        arrival: '2024-08-12T15:45:00.000+02:00',
        tolerances: {
          before: 60,
          after: 60,
        },
      };

      store.dispatch(stdcmConfSliceActions.updateStdcmPathStep(newDestination));
      const state = store.getState()[stdcmConfSlice.name];
      expect(state.stdcmPathSteps.at(-1)).toEqual(newDestination);
    });
  });

  testCommonConfReducers(stdcmConfSlice);
});
