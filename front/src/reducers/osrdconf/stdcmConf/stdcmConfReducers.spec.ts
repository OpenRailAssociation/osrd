import { last } from 'lodash';
import { describe, it, expect } from 'vitest';

import { ArrivalTimeTypes } from 'applications/stdcm/types';
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
  speedLimitByTag: 'init-tag',
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
    expect(state.pathSteps).toBe(stdcmConfInitialState.pathSteps);
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

  describe('Origin updates', () => {
    const store = createStore(initialStateSTDCMConfig);
    const newOrigin = {
      ...paris,
      arrivalType: ArrivalTimeTypes.PRECISE_TIME,
    };

    it('should handle updateOriginArrival', () => {
      store.dispatch(stdcmConfSliceActions.updateOrigin(newOrigin));
      store.dispatch(stdcmConfSliceActions.updateOriginArrival('2024-08-12T15:45:00.000+02:00'));
      const state = store.getState()[stdcmConfSlice.name];
      expect(state.pathSteps[0]).toEqual({
        ...newOrigin,
        arrival: '2024-08-12T15:45:00.000+02:00',
      });
    });

    it('should handle updateOriginArrival with undefined', () => {
      store.dispatch(stdcmConfSliceActions.updateOriginArrival(undefined));
      const state = store.getState()[stdcmConfSlice.name];
      expect(state.pathSteps[0]).toEqual({
        ...newOrigin,
        arrival: undefined,
      });
    });

    it('should handle updateOriginArrivalType', () => {
      store.dispatch(stdcmConfSliceActions.updateOriginArrivalType(ArrivalTimeTypes.PRECISE_TIME));
      const state = store.getState()[stdcmConfSlice.name];
      expect(state.pathSteps[0]).toEqual({
        ...newOrigin,
      });
    });

    it('should handle updateOriginTolerances', () => {
      store.dispatch(
        stdcmConfSliceActions.updateOriginTolerances({ toleranceBefore: 300, toleranceAfter: 300 })
      );
      const state = store.getState()[stdcmConfSlice.name];
      expect(state.pathSteps[0]).toEqual({
        ...newOrigin,
        arrivalToleranceBefore: 300,
        arrivalToleranceAfter: 300,
      });
    });
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

  describe('Destination updates', () => {
    const store = createStore(initialStateSTDCMConfig);
    const newDestination = {
      ...brest,
      arrivalType: ArrivalTimeTypes.ASAP,
    };

    it('should handle updateDestinationArrival', () => {
      store.dispatch(stdcmConfSliceActions.updateDestination(newDestination));
      store.dispatch(
        stdcmConfSliceActions.updateDestinationArrival('2024-08-12T15:45:00.000+02:00')
      );
      const state = store.getState()[stdcmConfSlice.name];
      expect(last(state.pathSteps)).toEqual({
        ...newDestination,
        arrival: '2024-08-12T15:45:00.000+02:00',
      });
    });

    it('should handle updateDestinationArrival with undefined', () => {
      store.dispatch(stdcmConfSliceActions.updateDestinationArrival(undefined));
      const state = store.getState()[stdcmConfSlice.name];
      expect(last(state.pathSteps)).toEqual({
        ...newDestination,
        arrival: undefined,
      });
    });

    it('should handle updateDestinationArrivalType', () => {
      store.dispatch(
        stdcmConfSliceActions.updateDestinationArrivalType(ArrivalTimeTypes.PRECISE_TIME)
      );
      const state = store.getState()[stdcmConfSlice.name];
      expect(last(state.pathSteps)).toEqual({
        ...newDestination,
        arrivalType: ArrivalTimeTypes.PRECISE_TIME,
      });
    });

    it('should handle updateDestinationTolerances', () => {
      store.dispatch(
        stdcmConfSliceActions.updateDestinationTolerances({
          toleranceBefore: 300,
          toleranceAfter: 300,
        })
      );
      const state = store.getState()[stdcmConfSlice.name];
      expect(last(state.pathSteps)).toEqual({
        ...newDestination,
        arrivalType: ArrivalTimeTypes.PRECISE_TIME,
        arrivalToleranceBefore: 300,
        arrivalToleranceAfter: 300,
      });
    });
  });

  testCommonConfReducers(stdcmConfSlice);
});
