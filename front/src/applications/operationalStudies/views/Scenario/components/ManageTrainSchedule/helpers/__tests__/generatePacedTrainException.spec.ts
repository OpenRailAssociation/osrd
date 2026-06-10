import { describe, expect, it } from 'vitest';

import type { PacedTrainWithPaced } from 'applications/operationalStudies/types';
import type { PathItem, TrainSchedule } from 'common/api/osrdEditoastApi';

import { generatePacedTrainException } from '../buildPacedTrainException';

describe('generatePacedTrainException', () => {
  // ===========================================================================
  // Shared fixtures
  // ===========================================================================

  const westStationPathStep: PathItem = {
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
  };

  const southStationPathStep: PathItem = {
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
  };

  /**
   * Original paced train as stored in the backend.
   *   - Base name: 'test', start: 12:45, interval: 1h, time_window: 3h
   *   - Generates 3 indexed occurrences:
   *       index 0 → 'test 1' @ 12:45
   *       index 1 → 'test 3' @ 13:45
   *       index 2 → 'test 5' @ 14:45
   */
  const originalPacedTrain: Omit<PacedTrainWithPaced, 'train_schedule_set_id'> = {
    train_name: 'test',
    start_time: new Date('2025-06-02T12:45:00.000Z').getTime(),
    category: { main_category: 'FREIGHT_TRAIN' },
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
    paced: {
      time_window: 'PT3H',
      interval: 'PT1H',
      exceptions: [],
    },
    path: [westStationPathStep, southStationPathStep],
    power_restrictions: [],
    rolling_stock_name: 'DUAL-MODE_RS_E2Ee',
    schedule: [],
    speed_limit_tag: null,
  };

  /**
   * Base updated occurrence matching the original paced train at index 0.
   *   - name: 'test 1' = computeOccurrenceName('test', 0)
   *   - startTime: 12:45 = base + 0 x 1h
   */
  const baseUpdatedOccurrence: TrainSchedule = {
    train_name: 'test 1',
    start_time: new Date('2025-06-02T12:45:00.000Z').getTime(),
    category: { main_category: 'FREIGHT_TRAIN' },
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
    path: [westStationPathStep, southStationPathStep],
    power_restrictions: [],
    rolling_stock_name: 'DUAL-MODE_RS_E2Ee',
    schedule: [],
    speed_limit_tag: null,
  };

  // ===========================================================================
  //  INDEXED OCCURRENCES  (auto-generated from cadence)
  // ===========================================================================

  describe('indexed occurrence', () => {
    describe('when unmodified (occurrence matches the base paced train)', () => {
      it('should return an empty diff for an occurrence identical to the base', () => {
        const exception = generatePacedTrainException(baseUpdatedOccurrence, originalPacedTrain, 0);
        expect(exception).toEqual({});
      });

      it('should not include start_time when it matches base + index x interval', () => {
        // occurrence 2 -> 12:45 + 2x1h = 14:45
        const exception = generatePacedTrainException(
          {
            ...baseUpdatedOccurrence,
            start_time: new Date('2025-06-02T14:45:00.000Z').getTime(),
            train_name: 'test 5', // computeOccurrenceName('test', 2)
          },
          originalPacedTrain,
          2
        );
        expect(exception).not.toHaveProperty('start_time');
        expect(exception).not.toHaveProperty('train_name');
      });
    });

    // -------------------------------------------------------------------------
    // Reverting all changes -> empty diff
    // -------------------------------------------------------------------------

    describe('when all changes are reverted to base values', () => {
      it('should return an empty diff when every field matches the base for occurrence 1', () => {
        const exception = generatePacedTrainException(
          {
            ...baseUpdatedOccurrence,
            start_time: new Date('2025-06-02T13:45:00.000Z').getTime(), // base + 1x1h
            train_name: 'test 3', // computeOccurrenceName('test', 1)
          },
          originalPacedTrain,
          1
        );
        expect(exception).toEqual({});
      });
    });

    // -------------------------------------------------------------------------
    // Modifying all simple change groups at once (all except path_and_schedule)
    // -------------------------------------------------------------------------

    describe('modifying all simple change groups at once', () => {
      it('should detect every simple change group in a single diff', () => {
        const exception = generatePacedTrainException(
          {
            ...baseUpdatedOccurrence,
            category: { main_category: 'HIGH_SPEED_TRAIN' },
            labels: ['express'],
            speed_limit_tag: 'V160',
            initial_speed: 30,
            rolling_stock_name: 'OTHER_RS',
            comfort: 'AIR_CONDITIONING',
            constraint_distribution: 'STANDARD',
            options: {
              use_electrical_profiles: false,
              use_speed_limits_for_simulation: true,
              stops_at_end_of_block: false,
            },
            start_time: new Date('2025-06-02T13:00:00.000Z').getTime(),
            train_name: 'express 42',
          },
          originalPacedTrain,
          0
        );
        expect(exception).toMatchObject({
          rolling_stock_category: { value: { main_category: 'HIGH_SPEED_TRAIN' } },
          labels: { value: ['express'] },
          speed_limit_tag: { value: 'V160' },
          initial_speed: { value: 30 },
          rolling_stock: { rolling_stock_name: 'OTHER_RS', comfort: 'AIR_CONDITIONING' },
          constraint_distribution: { value: 'STANDARD' },
          options: {
            value: {
              use_electrical_profiles: false,
              use_speed_limits_for_simulation: true,
              stops_at_end_of_block: false,
            },
          },
          start_time: { value: new Date('2025-06-02T13:00:00.000Z').getTime() },
          train_name: { value: 'express 42' },
        });
        // path_and_schedule should not appear since path was not modified
        expect(exception).not.toHaveProperty('path_and_schedule');
      });
    });

    // -------------------------------------------------------------------------
    // Modifying the path_and_schedule silo
    // -------------------------------------------------------------------------

    describe('modifying path_and_schedule', () => {
      it('should detect path_and_schedule when path location and schedule change', () => {
        const modifiedSouthPathStep: PathItem = {
          id: '1-1',
          location: {
            type: 'operational_point_part_reference',
            operational_point: {
              main_code: 'NS',
              secondary_code: 'BV',
              type: 'domestic',
              country_code: 'FR',
            },
            local_track_name: null,
          },
        };

        const exception = generatePacedTrainException(
          {
            ...baseUpdatedOccurrence,
            path: [westStationPathStep, modifiedSouthPathStep],
            schedule: [{ at: '1-1', stop_for: 'PT30S' }],
          },
          originalPacedTrain,
          0
        );
        expect(exception).toHaveProperty('path_and_schedule');
        expect(exception.path_and_schedule).toMatchObject({
          path: expect.arrayContaining([
            expect.objectContaining({
              location: expect.objectContaining({
                type: 'operational_point_part_reference',
                operational_point: {
                  main_code: 'NS',
                  secondary_code: 'BV',
                  type: 'domestic',
                  country_code: 'FR',
                },
                local_track_name: null,
              }),
            }),
          ]),
          schedule: [{ at: '1-1', stop_for: 'PT30S' }],
        });
        // Other simple change groups should not appear
        expect(exception).not.toHaveProperty('rolling_stock_category');
        expect(exception).not.toHaveProperty('labels');
      });
    });

    // -------------------------------------------------------------------------
    // Modifying multiple fields at once -- some changed, some unchanged
    // -------------------------------------------------------------------------

    describe('modifying multiple fields at once', () => {
      it('should include all changed fields and none of the unchanged ones', () => {
        const exception = generatePacedTrainException(
          {
            ...baseUpdatedOccurrence,
            category: { main_category: 'HIGH_SPEED_TRAIN' },
            labels: ['vip'],
            // startTime and name match occurrence 1 -> no diff for those
            start_time: new Date('2025-06-02T13:45:00.000Z').getTime(),
            train_name: 'test 3', // computeOccurrenceName('test', 1)
          },
          originalPacedTrain,
          1
        );

        expect(exception).toMatchObject({
          rolling_stock_category: { value: { main_category: 'HIGH_SPEED_TRAIN' } },
          labels: { value: ['vip'] },
        });
        expect(exception).not.toHaveProperty('start_time');
        expect(exception).not.toHaveProperty('train_name');
        expect(exception).not.toHaveProperty('speed_limit_tag');
      });
    });
  });

  // ===========================================================================
  //  ADDED EXCEPTIONS  (manually added occurrences, not part of the cadence)
  //  occurrenceIndex = null
  // ===========================================================================

  describe('added exception (occurrenceIndex = null)', () => {
    // -------------------------------------------------------------------------
    // start_time -- always present
    // An added exception has no natural position in the cadence, so the diff
    // must always carry its start_time.
    // -------------------------------------------------------------------------

    describe('start_time (always present)', () => {
      it('should always include start_time even when no other field is changed', () => {
        const exception = generatePacedTrainException(
          {
            ...baseUpdatedOccurrence,
            start_time: new Date('2025-06-02T16:00:00.000Z').getTime(),
            train_name: 'test/+',
          },
          originalPacedTrain,
          null
        );
        expect(exception).toMatchObject({
          start_time: { value: new Date('2025-06-02T16:00:00.000Z').getTime() },
        });
      });

      it('should include start_time even when it coincides with the base paced train start time', () => {
        // 12:45 is also the base start time, but an added exception always carries it
        const exception = generatePacedTrainException(
          { ...baseUpdatedOccurrence, train_name: 'test/+' },
          originalPacedTrain,
          null
        );
        expect(exception).toHaveProperty('start_time');
      });
    });

    // -------------------------------------------------------------------------
    // train_name -- default pattern is "baseName/+"
    // -------------------------------------------------------------------------

    describe('train_name', () => {
      it('should not include train_name when it matches the default "baseName/+" pattern', () => {
        const exception = generatePacedTrainException(
          {
            ...baseUpdatedOccurrence,
            start_time: new Date('2025-06-02T16:00:00.000Z').getTime(),
            train_name: 'test/+',
          },
          originalPacedTrain,
          null
        );
        expect(exception).not.toHaveProperty('train_name');
      });

      it('should include train_name when the user gives a custom name', () => {
        const exception = generatePacedTrainException(
          {
            ...baseUpdatedOccurrence,
            start_time: new Date('2025-06-02T16:00:00.000Z').getTime(),
            train_name: 'special departure',
          },
          originalPacedTrain,
          null
        );
        expect(exception).toMatchObject({
          train_name: { value: 'special departure' },
        });
      });
    });

    // -------------------------------------------------------------------------
    // Modifying fields on an added exception
    // -------------------------------------------------------------------------

    describe('modifying fields', () => {
      it('should detect all simple change groups alongside the mandatory start_time', () => {
        const exception = generatePacedTrainException(
          {
            ...baseUpdatedOccurrence,
            start_time: new Date('2025-06-02T17:30:00.000Z').getTime(),
            train_name: 'extra train',
            category: { main_category: 'HIGH_SPEED_TRAIN' },
            labels: ['priority'],
            speed_limit_tag: 'V200',
            rolling_stock_name: 'ANOTHER_RS',
          },
          originalPacedTrain,
          null
        );
        expect(exception).toMatchObject({
          start_time: { value: new Date('2025-06-02T17:30:00.000Z').getTime() },
          train_name: { value: 'extra train' },
          rolling_stock_category: { value: { main_category: 'HIGH_SPEED_TRAIN' } },
          labels: { value: ['priority'] },
          speed_limit_tag: { value: 'V200' },
          rolling_stock: { rolling_stock_name: 'ANOTHER_RS' },
        });
      });
    });
  });
});
