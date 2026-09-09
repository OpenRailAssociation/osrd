import { describe, it, expect } from 'vitest';

import type { LightRollingStockWithLiveries } from 'common/api/osrdEditoastApi';
import type { TrainScheduleWithDetails } from 'modules/trainSchedule/types';
import { Duration } from 'utils/duration';

import {
  blankNewTrainState,
  setupStateWithTrainSchedule,
  type ItineraryModalTrainState,
} from '../ItineraryModal';

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

describe('blankNewTrainState', () => {
  it('should use given date as start time', () => {
    const state = blankNewTrainState(new Date(2026, 7, 4, 0, 0, 0), 'CALENDAR');
    expect(state.startTime).toEqual(new Date(2026, 7, 4, 0, 0, 0));
  });
});

describe('setupStateWithTrainSchedule', () => {
  describe('when given a paced train', () => {
    const blankState = blankNewTrainState(undefined, 'CALENDAR');
    const pacedTrain: TrainScheduleWithDetails = {
      ...baseTrainScheduleWithSummary,
      paced: {
        timeWindow: new Duration({ minutes: 60 }),
        interval: new Duration({ minutes: 30 }),
        exceptions: [],
      },
    };

    it('properly setup the state of the itinerary modal with paced train details', () => {
      const state = setupStateWithTrainSchedule(pacedTrain, 'CALENDAR');
      const expectedState: ItineraryModalTrainState = {
        ...blankState,
        usingElectricalProfiles: false,
        labels: ['label1'],
        rollingStockId: 1,
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
});
