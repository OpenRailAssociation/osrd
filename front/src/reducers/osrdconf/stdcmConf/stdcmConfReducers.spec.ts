import { describe, it, expect } from 'vitest';

import { ArrivalTimeTypes, StdcmStopTypes } from 'applications/stdcm/types';
import {
  addNewStdcmResult,
  retainSimulation,
  selectSimulation,
  stdcmConfInitialState,
  stdcmConfSlice,
  stdcmConfSliceActions,
  updateLastStdcmResult,
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
  speedLimitByTag: 'init-tag',
  stdcmPathSteps,
};

describe('stdcmConfReducers', () => {
  it('should return initial state', () => {
    const store = createStore();
    const state = store.getState()[stdcmConfSlice.name];
    expect(state).toEqual(stdcmConfInitialState);
  });

  describe('should handle margins update', () => {
    it('should handle updateStandardAllowance', () => {
      const initialTimeStandardAllowance = testDataBuilder.buildTimeStandardAllowance(10);
      const store = createStore({
        margins: { standardAllowance: initialTimeStandardAllowance },
      });

      const stateBefore = store.getState()[stdcmConfSlice.name];
      expect(stateBefore.margins.standardAllowance).toBe(initialTimeStandardAllowance);

      const newStandardAllowance = testDataBuilder.buildPercentageStandardAllowance(5);
      store.dispatch(stdcmConfSliceActions.updateStandardAllowance(newStandardAllowance));

      const stateAfter = store.getState()[stdcmConfSlice.name];
      expect(stateAfter.margins.standardAllowance).toBe(newStandardAllowance);
    });

    it('should handle updateGridMarginBefore', () => {
      const newGridMarginBefore = 5;
      const store = createStore(initialStateSTDCMConfig);
      store.dispatch(stdcmConfSliceActions.updateGridMarginBefore(newGridMarginBefore));
      const state = store.getState()[stdcmConfSlice.name];
      expect(state.margins.gridMarginBefore).toStrictEqual(newGridMarginBefore);
    });

    it('should handle updateGridMarginAfter', () => {
      const newGridMarginAfter = 5;
      const store = createStore(initialStateSTDCMConfig);
      store.dispatch(stdcmConfSliceActions.updateGridMarginAfter(newGridMarginAfter));
      const state = store.getState()[stdcmConfSlice.name];
      expect(state.margins.gridMarginAfter).toStrictEqual(newGridMarginAfter);
    });
  });

  it('should handle resetStdcmConfig', () => {
    const store = createStore(initialStateSTDCMConfig);
    store.dispatch(stdcmConfSliceActions.resetStdcmConfig());

    const state = store.getState()[stdcmConfSlice.name];
    expect(state.rollingStockID).toBe(stdcmConfInitialState.rollingStockID);
    expect(state.stdcmPathSteps).toBe(stdcmConfInitialState.stdcmPathSteps);
    expect(state.speedLimitByTag).toBe(stdcmConfInitialState.speedLimitByTag);
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
    it('should handle towedRollingStockID', () => {
      store.dispatch(stdcmConfSliceActions.updateTowedRollingStockID(11));
      const state = store.getState()[stdcmConfSlice.name];
      expect(state.towedRollingStockID).toEqual(11);
    });
  });

  describe('StdcmPathStep updates', () => {
    const store = createStore(initialStateSTDCMConfig);

    it('should handle origin update', () => {
      const origin = store.getState()[stdcmConfSlice.name].stdcmPathSteps.at(0)!;
      expect(origin.isVia).toBe(false);
      const updates = {
        arrivalType: ArrivalTimeTypes.ASAP,
        arrival: new Date('2024-08-12T15:45:00.000+02:00'),
        tolerances: {
          before: 60,
          after: 60,
        },
      };

      store.dispatch(stdcmConfSliceActions.updateStdcmPathStep({ id: origin.id, updates }));
      const state = store.getState()[stdcmConfSlice.name];
      expect(state.stdcmPathSteps.at(0)).toEqual({ ...origin, ...updates });
    });

    it('should handle via update', () => {
      const via = store.getState()[stdcmConfSlice.name].stdcmPathSteps.at(1)!;
      expect(via.isVia).toBe(true);
      const updates = {
        stopType: StdcmStopTypes.DRIVER_SWITCH,
        stopFor: 1,
      };

      store.dispatch(stdcmConfSliceActions.updateStdcmPathStep({ id: via.id, updates }));
      const state = store.getState()[stdcmConfSlice.name];
      expect(state.stdcmPathSteps.at(1)).toEqual({ ...via, ...updates });
    });

    it('should handle destination update', () => {
      const destination = store.getState()[stdcmConfSlice.name].stdcmPathSteps.at(-1)!;
      expect(destination.isVia).toBe(false);
      const updates = {
        arrivalType: ArrivalTimeTypes.ASAP,
        arrival: new Date('2024-08-12T15:45:00.000+02:00'),
        tolerances: {
          before: 60,
          after: 60,
        },
      };

      store.dispatch(stdcmConfSliceActions.updateStdcmPathStep({ id: destination.id, updates }));
      const state = store.getState()[stdcmConfSlice.name];
      expect(state.stdcmPathSteps.at(-1)).toEqual({ ...destination, ...updates });
    });
  });

  describe('StdcmResults updates', () => {
    const simulation = {
      index: 0,
      creationDate: new Date(),
      inputs: {
        pathSteps: stdcmPathSteps,
        linkedTrains: { anteriorTrain: undefined, posteriorTrain: undefined },
      },
    };

    it('should handle adding new simulations', () => {
      const store = createStore();
      const { simulations } = store.getState()[stdcmConfSlice.name];
      expect(simulations.length).toBe(0);

      store.dispatch(addNewStdcmResult(simulation));
      let state = store.getState()[stdcmConfSlice.name];
      expect(state.simulations.length).toEqual(1);
      expect(state.simulations.at(0)).toEqual(simulation);

      const newSimulation = {
        ...simulation,
        index: 1,
      };

      store.dispatch(addNewStdcmResult(newSimulation));
      state = store.getState()[stdcmConfSlice.name];
      expect(state.simulations.length).toEqual(2);
      expect(state.simulations.at(0)).toEqual(simulation);
      expect(state.simulations.at(1)).toEqual(newSimulation);
    });

    it('should handle updating last simulation', () => {
      const store = createStore({ simulations: [simulation] });
      const { simulations } = store.getState()[stdcmConfSlice.name];
      expect(simulations.length).toBe(1);

      const newSimulation = {
        ...simulation,
        index: 1,
      };

      store.dispatch(updateLastStdcmResult(newSimulation));
      const state = store.getState()[stdcmConfSlice.name];
      expect(state.simulations.length).toEqual(1);
      expect(state.simulations.at(0)).toEqual(newSimulation);
    });

    it('should handle selecting a simulation', () => {
      const store = createStore({ simulations: [simulation] });
      store.dispatch(selectSimulation(0));
      const state = store.getState()[stdcmConfSlice.name];
      expect(state.selectedSimulationIndex).toEqual(0);
    });

    it('should handle retaining a simulation', () => {
      const store = createStore({ simulations: [simulation] });
      store.dispatch(retainSimulation(0));
      const state = store.getState()[stdcmConfSlice.name];
      expect(state.retainedSimulationIndex).toEqual(0);
    });
  });

  testCommonConfReducers(stdcmConfSlice);
});
