import { describe, it, expect } from 'vitest';

import type { LightRollingStockWithLiveries } from 'common/api/osrdEditoastApi';
import type { TrainScheduleWithDetails } from 'modules/trainSchedule/types';
import {
  operationalStudiesConfSlice,
  operationalStudiesInitialConf,
} from 'reducers/osrdconf/operationalStudiesConf';
import testCommonConfReducers from 'reducers/osrdconf/osrdConfCommon/__tests__/utils';
import type { OperationalStudiesConfState } from 'reducers/osrdconf/types';
import { createStoreWithoutMiddleware } from 'store';
import { Duration } from 'utils/duration';

import testTrainSettingsReducer from './trainSettingsReducer';

const baseTrainScheduleWithSummary: TrainScheduleWithDetails = {
  id: 1,
  name: 'train1',
  train_schedule_set_id: 1000,
  constraint_distribution: 'STANDARD',
  rollingStockName: 'rollingStock1',
  rollingStock: { id: 1, name: 'rollingStock1' } as LightRollingStockWithLiveries,
  path: [
    {
      id: 'id1',
      location: {
        type: 'operational_point_part_reference',
        operational_point: { uic: 123, type: 'uic' },
      },
    },
    {
      id: 'id2',
      location: {
        type: 'operational_point_part_reference',
        operational_point: { uic: 234, type: 'uic' },
      },
    },
  ],
  speedLimitTag: 'MA100',
  labels: ['label1'],
  margins: { boundaries: ['id2'], values: ['10%', '0%'] },
  startTime: new Date('2021-01-01T00:00:00Z'),
  options: { use_electrical_profiles: false },
  stopsCount: 2,
  summary: {
    isValid: true,
    pathLength: '100',
    duration: new Duration({ milliseconds: 1000 }),
    mechanicalEnergyConsumed: 100,
    pathItemTimes: { base: [], provisional: [], final: [] },
    pathItemRespect: { margins: [], times: [] },
  },
};

const createStore = (extraInitialState?: Partial<OperationalStudiesConfState>) =>
  createStoreWithoutMiddleware({
    [operationalStudiesConfSlice.name]: {
      ...operationalStudiesInitialConf,
      ...extraInitialState,
    },
  });

describe('simulationConfReducer', () => {
  it('should return initial state', () => {
    const store = createStore();
    const state = store.getState()[operationalStudiesConfSlice.name];
    expect(state).toEqual(operationalStudiesInitialConf);
  });

  it('should update itinerary form data at once', () => {
    const store = createStore();
    store.dispatch(
      operationalStudiesConfSlice.actions.updateItineraryForm({
        name: 'train1',
        category: {
          main_category: 'INTERCITY_TRAIN',
        },
        rollingStockId: 1,
        rollingStockName: '',
        speedLimitTag: 'MA100',
        pathSteps: [],
      })
    );

    const state = store.getState()[operationalStudiesConfSlice.name];
    expect(state.name).toBe('train1');
    expect(state.category).toEqual({ main_category: 'INTERCITY_TRAIN' });
    expect(state.rollingStockID).toBe(1);
    expect(state.speedLimitByTag).toBe('MA100');
    expect(state.pathSteps).toEqual([]);
  });

  describe('selectTrainToEdit', () => {
    it('paced train case', () => {
      const pacedTrain: TrainScheduleWithDetails = {
        ...baseTrainScheduleWithSummary,
        paced: {
          timeWindow: new Duration({ minutes: 60 }),
          interval: new Duration({ minutes: 30 }),
          exceptions: [],
        },
      };

      const store = createStore();
      store.dispatch(
        operationalStudiesConfSlice.actions.selectTrainToEdit({ trainSchedule: pacedTrain })
      );

      const state = store.getState()[operationalStudiesConfSlice.name];
      const expectedState: OperationalStudiesConfState = {
        ...operationalStudiesInitialConf,
        usingElectricalProfiles: false,
        labels: ['label1'],
        rollingStockID: 1,
        rollingStockName: 'rollingStock1',
        speedLimitByTag: 'MA100',
        name: 'train1',
        pathSteps: [
          {
            id: 'id1',
            location: {
              type: 'operational_point_part_reference',
              operational_point: { uic: 123, type: 'uic' },
            },
            name: '123',
            theoreticalMargin: '10%',
            arrival: null,
            stopFor: null,
            receptionSignal: 'OPEN',
          },
          {
            id: 'id2',
            location: {
              type: 'operational_point_part_reference',
              operational_point: { uic: 234, type: 'uic' },
            },
            name: '234',
            theoreticalMargin: undefined,
            arrival: null,
            stopFor: null,
            receptionSignal: 'OPEN',
          },
        ],
        startTime: new Date('2021-01-01T00:00:00+00:00'),
        timeWindow: new Duration({ minutes: 60 }),
        interval: new Duration({ minutes: 30 }),
        editingTrainType: 'pacedTrain',
      };
      expect(state).toEqual(expectedState);
    });
  });

  testCommonConfReducers(operationalStudiesConfSlice);
  testTrainSettingsReducer();
});
