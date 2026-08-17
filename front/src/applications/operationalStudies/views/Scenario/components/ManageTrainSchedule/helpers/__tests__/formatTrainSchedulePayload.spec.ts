import { describe, expect, it } from 'vitest';

import { Duration } from 'utils/duration';

import type { ItineraryModalTrainState } from '../../Itinerary/ItineraryModal';
import { formatTrainSchedulePayload } from '../formatTrainSchedulePayload';

describe('formatTrainSchedulePayload', () => {
  const rawTrainState: ItineraryModalTrainState = {
    rollingStockName: 'rollingStock1',
    name: 'test',
    startTime: new Date('2025-06-02T12:45:00.000Z'),
    initialSpeed: 0,
    labels: [],
    rollingStockComfort: 'STANDARD',
    category: {
      main_category: 'FREIGHT_TRAIN',
    },
    pathSteps: [
      {
        id: '0-0',
        location: {
          type: 'operational_point_part_reference',
          operational_point: {
            main_code: 'WS',
            secondary_code: 'BV',
            type: 'domestic',
            country_code: 'FR',
          },
          local_track_name: null,
        },
        name: 'West_station',
        arrival: null,
        stopFor: null,
        theoreticalMargin: '0%',
        positionOnPath: 0,
        coordinates: [-0.38775000008590166, 49.50000120103261],
      },
      {
        id: '1-1',
        location: {
          type: 'operational_point_part_reference',
          operational_point: {
            main_code: 'SS',
            secondary_code: 'BV',
            type: 'domestic',
            country_code: 'FR',
          },
          local_track_name: null,
        },
        name: 'South_station',
        arrival: null,
        stopFor: null,
        receptionSignal: 'OPEN',
        positionOnPath: 49103000,
        coordinates: [-0.16408630124250465, 49.46600036530178],
      },
    ],
    constraintDistribution: 'MARECO',
    usingElectricalProfiles: true,
    usingSpeedLimits: true,
    stopsAtEndOfBlock: false,
    powerRestriction: [],
    timeWindow: Duration.parse('PT3H'),
    interval: Duration.parse('PT1H'),
    editingTrainType: 'pacedTrain',
    addedExceptions: [],
  };

  describe('User creates a paced train', () => {
    it('should return a TrainSchedule payload with paced fields and empty exceptions', () => {
      const newTrainSchedulePayload = formatTrainSchedulePayload(rawTrainState);
      expect(newTrainSchedulePayload).toEqual({
        category: {
          main_category: 'FREIGHT_TRAIN',
        },
        comfort: 'STANDARD',
        constraint_distribution: 'MARECO',
        initial_speed: 0,
        labels: [],
        margins: { boundaries: [], values: ['0%'] },
        options: {
          stops_at_end_of_block: false,
          use_electrical_profiles: true,
          use_speed_limits_for_simulation: true,
        },
        path: [
          {
            id: '0-0',
            location: {
              type: 'operational_point_part_reference',
              operational_point: {
                main_code: 'WS',
                secondary_code: 'BV',
                country_code: 'FR',
                type: 'domestic',
              },
              local_track_name: null,
            },
          },
          {
            id: '1-1',
            location: {
              type: 'operational_point_part_reference',
              operational_point: {
                main_code: 'SS',
                secondary_code: 'BV',
                country_code: 'FR',
                type: 'domestic',
              },
              local_track_name: null,
            },
          },
        ],
        power_restrictions: [],
        rolling_stock_name: 'rollingStock1',
        schedule: [],
        speed_limit_tag: undefined,
        start_time: new Date('2025-06-02T12:45:00.000Z').getTime(),
        train_name: 'test',
        paced: {
          time_window: 'PT3H',
          interval: 'PT1H',
          exceptions: [],
        },
      });
    });
  });

  describe('User creates a unique train', () => {
    it('should return a TrainSchedule payload without paced fields', () => {
      const uniqueTrainState: ItineraryModalTrainState = {
        ...rawTrainState,
        editingTrainType: 'uniqueTrain',
      };
      const newTrainSchedulePayload = formatTrainSchedulePayload(uniqueTrainState);
      expect(newTrainSchedulePayload.paced).toBeUndefined();
      expect(newTrainSchedulePayload.train_name).toBe('test');
      expect(newTrainSchedulePayload.rolling_stock_name).toBe('rollingStock1');
    });
  });

  describe('The new origin has an arrival time (origin was deleted)', () => {
    it('should fold the first waypoint arrival into the start time and shift the others', () => {
      const trainState: ItineraryModalTrainState = {
        ...rawTrainState,
        pathSteps: [
          { ...rawTrainState.pathSteps[0]!, arrival: Duration.parse('PT10M') },
          { ...rawTrainState.pathSteps[1]!, arrival: Duration.parse('PT25M') },
        ],
      };

      const payload = formatTrainSchedulePayload(trainState);

      expect(payload.start_time).toBe(new Date('2025-06-02T12:55:00.000Z').getTime());
      expect(payload.schedule).toEqual([
        {
          at: '1-1',
          arrival: 'PT15M',
          reception_signal: 'OPEN',
          stop_for: undefined,
        },
      ]);
    });
  });
});
