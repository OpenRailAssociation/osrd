import { describe, expect, it } from 'vitest';

import { defaultMapSettings } from 'reducers/commonMap';
import type { OperationalStudiesConfState } from 'reducers/osrdconf/types';
import { Duration } from 'utils/duration';

import { formatPacedTrainPayload } from '../formatTimetableItemPayload';

describe('formatPacedTrainPayload', () => {
  const rawOsrdconf: OperationalStudiesConfState = {
    timetableID: 184,
    rollingStockName: 'rollingStock1',
    rollingStockID: 1,
    infraID: 2,
    infraIsLocked: false,
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
          operational_point: { trigram: 'WS', secondary_code: 'BV', type: 'trigram' },
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
          operational_point: { trigram: 'SS', secondary_code: 'BV', type: 'trigram' },
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
    mapSettings: defaultMapSettings,
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
  const rollingStockName = 'DUAL-MODE_RS_E2Ee';
  describe('User creates a paced train', () => {
    it('should return a TrainSchedule payload with paced fields and empty exceptions', () => {
      const newTrainSchedulePayload = formatPacedTrainPayload(rawOsrdconf, rollingStockName);
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
                trigram: 'WS',
                secondary_code: 'BV',
                type: 'trigram',
              },
              local_track_name: null,
            },
          },
          {
            id: '1-1',
            location: {
              type: 'operational_point_part_reference',
              operational_point: {
                trigram: 'SS',
                secondary_code: 'BV',
                type: 'trigram',
              },
              local_track_name: null,
            },
          },
        ],
        power_restrictions: [],
        rolling_stock_name: 'DUAL-MODE_RS_E2Ee',
        schedule: [],
        speed_limit_tag: undefined,
        start_time: '2025-06-02T12:45:00.000Z',
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
      const osrdconfUniqueTrain: OperationalStudiesConfState = {
        ...rawOsrdconf,
        editingTrainType: 'uniqueTrain',
      };
      const newTrainSchedulePayload = formatPacedTrainPayload(
        osrdconfUniqueTrain,
        rollingStockName
      );
      expect(newTrainSchedulePayload.paced).toBeUndefined();
      expect(newTrainSchedulePayload.train_name).toBe('test');
      expect(newTrainSchedulePayload.rolling_stock_name).toBe('DUAL-MODE_RS_E2Ee');
    });
  });
});
