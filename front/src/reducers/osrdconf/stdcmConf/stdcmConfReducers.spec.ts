import { describe, it, expect } from 'vitest';

import {
  ArrivalTimeTypes,
  StdcmStopTypes,
  MarginType,
  type LinkedTrains,
  type StdcmSimulation,
} from 'applications/stdcm/types';
import type { LoadingGaugeType } from 'common/api/osrdEditoastApi';
import {
  stdcmConfInitialState,
  stdcmConfSlice,
  updateGridMarginAfter,
  updateGridMarginBefore,
  updateStandardAllowance,
  updateStdcmPathStep,
  retainSimulation,
  selectSimulation,
  addStdcmSimulations,
} from 'reducers/osrdconf/stdcmConf';
import type { OsrdStdcmConfState, StandardAllowance, StdcmPathStep } from 'reducers/osrdconf/types';
import { createStoreWithoutMiddleware } from 'store';
import { Duration } from 'utils/duration';

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
      type: MarginType.PERCENTAGE,
    }),
    buildTimeStandardAllowance: (value: number): StandardAllowance => ({
      value,
      type: MarginType.TIME_PER_DISTANCE,
    }),
    buildLinkedTrains(value?: Partial<LinkedTrains>): LinkedTrains {
      return {
        anteriorTrain: {
          date: '2025-02-06',
          time: '12:00',
          trainName: 'anterior train',
          ...value?.anteriorTrain,
        },
        posteriorTrain: {
          date: '2025-02-08',
          time: '12:00',
          trainName: 'posterior train',
          ...value?.posteriorTrain,
        },
      };
    },
  };
}

const testDataBuilder = {
  ...stdcmConfTestDataBuilder(),
  ...commonConfBuilder(),
};

const stdcmPathSteps: StdcmPathStep[] = [
  {
    operationalPoint: {
      id: '0',
      countryCode: 'FR',
      uic: 1,
      mainCode: 'A',
      secondaryCode: 'BV',
      name: 'Brest',
      coordinates: [48.38819835024553, -4.478289762812405],
    },
    id: '0',
    isVia: false,
    arrivalType: ArrivalTimeTypes.PRECISE_TIME,
    tolerances: {
      before: new Duration({ seconds: 60 }),
      after: new Duration({ seconds: 60 }),
    },
  },
  {
    operationalPoint: {
      id: '1',
      countryCode: 'FR',
      uic: 2,
      mainCode: 'B',
      secondaryCode: 'BV',
      name: 'Rennes',
      coordinates: [48.10326700633057, -1.6719908615098822],
    },
    id: '1',
    isVia: true,
    stopType: StdcmStopTypes.PASSAGE_TIME,
    consist: undefined,
  },
  {
    operationalPoint: {
      id: '2',
      countryCode: 'FR',
      uic: 3,
      mainCode: 'C',
      secondaryCode: 'BV',
      name: 'Lemans',
      coordinates: [47.99542250806296, 0.1918181738752042],
    },
    id: '2',
    isVia: true,
    stopType: StdcmStopTypes.PASSAGE_TIME,
    consist: undefined,
  },
  {
    operationalPoint: {
      id: '3',
      countryCode: 'FR',
      uic: 4,
      mainCode: 'D',
      secondaryCode: 'BV',
      name: 'Paris',
      coordinates: [48.904852473668086, 2.4369545094357736],
    },
    id: '3',
    isVia: true,
    stopType: StdcmStopTypes.PASSAGE_TIME,
    consist: undefined,
  },
  {
    operationalPoint: {
      id: '4',
      countryCode: 'FR',
      uic: 5,
      mainCode: 'E',
      secondaryCode: 'BV',
      name: 'Strasbourg',
      coordinates: [48.58505541984412, 7.73387081978364],
    },
    id: '4',
    isVia: false,
    arrivalType: ArrivalTimeTypes.PRECISE_TIME,
    tolerances: {
      before: new Duration({ seconds: 60 }),
      after: new Duration({ seconds: 60 }),
    },
  },
];

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
      store.dispatch(updateStandardAllowance(newStandardAllowance));

      const stateAfter = store.getState()[stdcmConfSlice.name];
      expect(stateAfter.margins.standardAllowance).toBe(newStandardAllowance);
    });

    it('should handle updateGridMarginBefore', () => {
      const newGridMarginBefore = new Duration({ seconds: 5 });
      const store = createStore(initialStateSTDCMConfig);
      store.dispatch(updateGridMarginBefore(newGridMarginBefore));
      const state = store.getState()[stdcmConfSlice.name];
      expect(state.margins.gridMarginBefore).toStrictEqual(newGridMarginBefore);
    });

    it('should handle updateGridMarginAfter', () => {
      const newGridMarginAfter = new Duration({ seconds: 5 });
      const store = createStore(initialStateSTDCMConfig);
      store.dispatch(updateGridMarginAfter(newGridMarginAfter));
      const state = store.getState()[stdcmConfSlice.name];
      expect(state.margins.gridMarginAfter).toStrictEqual(newGridMarginAfter);
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
          before: new Duration({ seconds: 60 }),
          after: new Duration({ seconds: 60 }),
        },
      };

      store.dispatch(updateStdcmPathStep({ id: origin.id, updates }));
      const state = store.getState()[stdcmConfSlice.name];
      expect(state.stdcmPathSteps.at(0)).toEqual({ ...origin, ...updates });
    });

    it('should handle via update', () => {
      const via = store.getState()[stdcmConfSlice.name].stdcmPathSteps.at(1)!;
      expect(via.isVia).toBe(true);
      const updates = {
        stopType: StdcmStopTypes.DRIVER_SWITCH,
        stopFor: new Duration({ minutes: 1 }),
      };

      store.dispatch(updateStdcmPathStep({ id: via.id, updates }));
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
          before: new Duration({ seconds: 60 }),
          after: new Duration({ seconds: 60 }),
        },
      };

      store.dispatch(updateStdcmPathStep({ id: destination.id, updates }));
      const state = store.getState()[stdcmConfSlice.name];
      expect(state.stdcmPathSteps.at(-1)).toEqual({ ...destination, ...updates });
    });
  });

  describe('StdcmResults updates', () => {
    const simulationInputs = {
      pathSteps: stdcmPathSteps,
      linkedTrains: { anteriorTrain: undefined, posteriorTrain: undefined },
      consist: {
        totalMass: 100,
        totalLength: 50,
        maxSpeed: 25,
        loadingGauge: 'GA' as LoadingGaugeType,
        speedLimitByTag: 'new-tag',
      },
    };

    const simulation = {
      index: 0,
      creationDate: new Date(),
      inputs: simulationInputs,
    };

    it('should add a new simulation', () => {
      const store = createStore({ simulations: [simulation] });
      const { simulations } = store.getState()[stdcmConfSlice.name];
      expect(simulations.length).toBe(1);

      const newSimulation: StdcmSimulation = {
        ...simulation,
        inputs: {
          ...simulation.inputs,
          consist: {
            totalMass: 75,
            totalLength: 20,
            maxSpeed: 10,
            loadingGauge: 'GA',
            speedLimitByTag: 'new-tag',
          },
        },
      };

      store.dispatch(addStdcmSimulations([newSimulation]));
      const state = store.getState()[stdcmConfSlice.name];
      expect(state.simulations.length).toEqual(2);
      expect(state.simulations[1].inputs).toEqual(newSimulation.inputs);
      expect(state.simulations[1].index).toEqual(1);
    });

    it('should handle selecting a simulation', () => {
      const store = createStore({ simulations: [simulation] });
      store.dispatch(selectSimulation(0));
      const state = store.getState()[stdcmConfSlice.name];
      expect(state.selectedSimulationIndex).toEqual(0);
      expect(state.stdcmPathSteps).toEqual(simulation.inputs.pathSteps);
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
