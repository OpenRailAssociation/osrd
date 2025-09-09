import { test, it, describe, expect } from 'vitest';

import type {
  PacedTrainException,
  TrainCategory,
  TrainMainCategory,
} from 'common/api/osrdEditoastApi';
import { defaultMapSettings } from 'reducers/commonMap';
import type {
  AddedExceptionId,
  IndexedOccurrenceId,
  TimetableItemToEditData,
  OperationalStudiesConfState,
  PacedTrainId,
} from 'reducers/osrdconf/types';
import { Duration } from 'utils/duration';

import { formatPacedTrainPayload } from '../formatTimetableItemPayload';

describe('formatTimetableItemPayload', () => {
  const rawOsrdconf: OperationalStudiesConfState = {
    timetableID: 184,
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
        deleted: false,
        location: {
          uic: 2,
          trigram: 'WS',
          secondary_code: 'BV',
          track_reference: null,
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
        deleted: false,
        location: {
          uic: 6,
          trigram: 'SS',
          secondary_code: 'BV',
          track_reference: null,
        },
        name: 'South_station',
        arrival: null,
        stopFor: null,
        locked: false,
        receptionSignal: 'OPEN',
        positionOnPath: 49103000,
        coordinates: [-0.16408630124250465, 49.46600036530178],
      },
    ],
    mapSettings: defaultMapSettings,
    constraintDistribution: 'MARECO',
    usingElectricalProfiles: true,
    usingSpeedLimits: true,
    powerRestriction: [],
    timeWindow: Duration.parse('PT3H'),
    interval: Duration.parse('PT1H'),
    editingItemType: 'pacedTrain',
    addedExceptions: [],
  };
  const rollingStockName = 'DUAL-MODE_RS_E2Ee';
  const rawTimetableItemToEditData: TimetableItemToEditData = {
    timetableItemId: 'paced_238' as PacedTrainId,
    originalPacedTrain: {
      category: {
        main_category: 'FREIGHT_TRAIN',
      },
      comfort: 'STANDARD',
      constraint_distribution: 'MARECO',
      exceptions: [],
      initial_speed: 0,
      labels: [],
      margins: {
        boundaries: [],
        values: ['0%'],
      },
      options: {
        use_electrical_profiles: true,
        use_speed_limits_for_simulation: true,
      },
      paced: {
        timeWindow: Duration.parse('PT3H'),
        interval: Duration.parse('PT1H'),
      },
      path: [
        {
          id: '0-0',
          deleted: false,
          trigram: 'WS',
          secondary_code: 'BV',
          track_reference: null,
        },
        {
          id: '1-1',
          deleted: false,
          trigram: 'SS',
          secondary_code: 'BV',
          track_reference: null,
        },
      ],
      power_restrictions: [],
      schedule: [],
      speed_limit_tag: null,
      id: 'paced_238' as PacedTrainId,
      name: 'test',
      startTime: new Date('2025-06-02T12:45:00.000Z'),
      stopsCount: 1,
      speedLimitTag: null,
      rollingStock: {
        id: 1,
        railjson_version: '3.3',
        name: 'DUAL-MODE_RS_E2Ee',
        metadata: {
          detail: 'dual-mode',
          family: '',
          type: '',
          grouping: '',
          series: '',
          subseries: '',
          unit: '',
          number: '',
          reference: 'dual-mode',
        },
        effort_curves: {
          modes: {
            thermal: {
              is_electric: false,
            },
          },
          default_mode: 'thermal',
        },
        length: 350.0,
        max_speed: 44.44444444444444,
        startup_time: 12.0,
        startup_acceleration: 0.06,
        comfort_acceleration: 0.54,
        const_gamma: 0.5,
        etcs_brake_params: null,
        inertia_coefficient: 1.05,
        base_power_class: '5',
        mass: 900000.0,
        rolling_resistance: {
          type: 'davis',
          A: 4400.0,
          B: 195.67674,
          C: 12.00002688,
        },
        loading_gauge: 'G1',
        power_restrictions: {
          C2: '1',
          C1: '3',
        },
        energy_sources: [],
        locked: false,
        supported_signaling_systems: ['BAL', 'BAPR', 'TVM300', 'TVM430'],
        liveries: [],
        primary_category: 'FREIGHT_TRAIN',
        other_categories: [],
      },
      summary: {
        isValid: true,
        duration: Duration.parse('PT1H32M12.133S'),
        pathLength: '101.0 km',
        mechanicalEnergyConsumed: 131,
        pathItemTimes: {
          base: [0, 5532133],
          provisional: [0, 5532133],
          final: [0, 5532133],
        },
      },
    },
  };
  describe('User creates a paced train', () => {
    it('should add the exceptions defined by user', () => {
      const userChanges: Partial<OperationalStudiesConfState> = {
        addedExceptions: [
          {
            key: 'az',
            startTime: new Date('2025-07-01T00:00:00'),
          },
        ],
      };
      const osrdconfWithUserChanges: OperationalStudiesConfState = {
        ...rawOsrdconf,
        ...userChanges,
      };
      const result = formatPacedTrainPayload(osrdconfWithUserChanges, rollingStockName);
      expect(result).toEqual({
        category: {
          main_category: 'FREIGHT_TRAIN',
        },
        comfort: 'STANDARD',
        constraint_distribution: 'MARECO',
        initial_speed: 0,
        labels: [],
        margins: { boundaries: [], values: ['0%'] },
        options: {
          use_electrical_profiles: true,
          use_speed_limits_for_simulation: true,
        },
        path: [
          {
            id: '0-0',
            trigram: 'WS',
            secondary_code: 'BV',
            track_reference: null,
            deleted: false,
          },
          {
            id: '1-1',
            trigram: 'SS',
            secondary_code: 'BV',
            track_reference: null,
            deleted: false,
          },
        ],
        power_restrictions: [],
        rolling_stock_name: 'DUAL-MODE_RS_E2Ee',
        schedule: [],
        speed_limit_tag: undefined,
        start_time: '2025-06-02T12:45:00.000Z',
        train_name: 'test',
        paced: { time_window: 'PT3H', interval: 'PT1H' },
        exceptions: [
          {
            key: 'az',
            start_time: {
              value: '2025-07-01T00:00:00.000Z',
            },
          },
        ],
      });
    });
  });
  describe('User updates a paced train', () => {
    describe('User creates 2 more added exceptions, and 1 already existed', () => {
      it('should concanate new added exceptions with existing ones', () => {
        const userChanges: Partial<OperationalStudiesConfState> = {
          addedExceptions: [
            {
              key: 'by',
              startTime: new Date('2025-07-02T00:00:00'),
            },
            {
              key: 'cx',
              startTime: new Date('2025-07-03T00:00:00'),
            },
          ],
        };
        const osrdconfWithUserChanges: OperationalStudiesConfState = {
          ...rawOsrdconf,
          ...userChanges,
        };
        const itemDataWithPREVIOUSLYAddedException = {
          ...rawTimetableItemToEditData,
          originalPacedTrain: {
            ...rawTimetableItemToEditData.originalPacedTrain,
            exceptions: [
              {
                key: 'az',
                start_time: {
                  value: '2025-07-01T00:00:00.000Z',
                },
              },
            ],
          },
        };
        const result = formatPacedTrainPayload(
          osrdconfWithUserChanges,
          rollingStockName,
          itemDataWithPREVIOUSLYAddedException
        );
        expect(result).toEqual({
          category: {
            main_category: 'FREIGHT_TRAIN',
          },
          comfort: 'STANDARD',
          constraint_distribution: 'MARECO',
          initial_speed: 0,
          labels: [],
          margins: { boundaries: [], values: ['0%'] },
          options: {
            use_electrical_profiles: true,
            use_speed_limits_for_simulation: true,
          },
          path: [
            {
              id: '0-0',
              trigram: 'WS',
              secondary_code: 'BV',
              track_reference: null,
              deleted: false,
            },
            {
              id: '1-1',
              trigram: 'SS',
              secondary_code: 'BV',
              track_reference: null,
              deleted: false,
            },
          ],
          power_restrictions: [],
          rolling_stock_name: 'DUAL-MODE_RS_E2Ee',
          schedule: [],
          speed_limit_tag: undefined,
          start_time: '2025-06-02T12:45:00.000Z',
          train_name: 'test',
          paced: { time_window: 'PT3H', interval: 'PT1H' },
          exceptions: [
            {
              key: 'az',
              start_time: {
                value: '2025-07-01T00:00:00.000Z',
              },
            },
            {
              key: 'by',
              start_time: {
                value: '2025-07-02T00:00:00.000Z',
              },
            },
            {
              key: 'cx',
              start_time: {
                value: '2025-07-03T00:00:00.000Z',
              },
            },
          ],
        });
      });
    });
    describe('use modifies category in the pace train to match the exception', () => {
      describe('exception is only a category exception', () => {
        const userChanges: Record<string, TrainMainCategory> = {
          category: 'NIGHT_TRAIN',
        };
        const osrdconfWithUserChanges: OperationalStudiesConfState = {
          ...rawOsrdconf,
          category: {
            main_category: userChanges.category,
          },
        };
        const timetableItemToEditDataWithOneChangeGroup: TimetableItemToEditData = {
          ...rawTimetableItemToEditData,
          originalPacedTrain: {
            ...rawTimetableItemToEditData.originalPacedTrain,
            exceptions: [
              {
                key: 'a6f39ce5-ae64-4135-af9b-22ee19877873',
                occurrence_index: 1,
                rolling_stock_category: {
                  value: {
                    main_category: 'NIGHT_TRAIN',
                  },
                },
              },
            ],
          },
        };
        test('the exception should be removed (it now matches completely the paced train)', () => {
          const result = formatPacedTrainPayload(
            osrdconfWithUserChanges,
            rollingStockName,
            timetableItemToEditDataWithOneChangeGroup
          );
          expect(result.exceptions).toEqual([]);
        });
      });
      describe('exception is both a label and category exception', () => {
        const userChanges: Record<string, TrainCategory> = {
          category: { main_category: 'NIGHT_TRAIN' },
        };
        const osrdconfWithUserChanges: OperationalStudiesConfState = {
          ...rawOsrdconf,
          category: userChanges.category,
        };

        const timetableItemToEditDataWithTwoChangeGroups: TimetableItemToEditData = {
          ...rawTimetableItemToEditData,
          originalPacedTrain: {
            ...rawTimetableItemToEditData.originalPacedTrain,
            exceptions: [
              {
                key: 'a6f39ce5-ae64-4135-af9b-22ee19877873',
                occurrence_index: 1,
                rolling_stock_category: {
                  value: {
                    main_category: 'NIGHT_TRAIN',
                  },
                },
                labels: {
                  value: ['label1', 'label2'],
                },
              },
            ],
          },
        };
        test('exception remains a label exception but the category change groups is removed', () => {
          const result = formatPacedTrainPayload(
            osrdconfWithUserChanges,
            rollingStockName,
            timetableItemToEditDataWithTwoChangeGroups
          );
          expect(result.exceptions).toEqual([
            {
              key: 'a6f39ce5-ae64-4135-af9b-22ee19877873',
              occurrence_index: 1,
              labels: {
                value: ['label1', 'label2'],
              },
            },
          ]);
        });
      });
    });
  });

  describe('User updates an occurrence', () => {
    describe('when the user modifies occurrence at index 2', () => {
      it('should create a new exception if it was not present before', () => {
        const userChanges: Partial<OperationalStudiesConfState> = {
          category: {
            main_category: 'HIGH_SPEED_TRAIN',
          },
          rollingStockComfort: 'HEATING',
          // These are not user changes but we need to updated these values so they match the ones from the occurrence at its specific index
          startTime: new Date('2025-06-02T14:45:00.000Z'), // occurrence with index 2 start time
          name: 'test 5', // occurrence with index 2 generated name
        };
        const timetableItemToEditDataWithExceptions: TimetableItemToEditData = {
          ...rawTimetableItemToEditData,
          originalPacedTrain: {
            ...rawTimetableItemToEditData.originalPacedTrain,
            exceptions: [
              {
                key: '444-555',
                occurrence_index: 0,
                speed_limit_tag: {
                  value: 'V100',
                },
              },
            ],
          },
          occurrenceId: 'indexedoccurrence_238_2' as IndexedOccurrenceId,
        };
        const osrdconfWithUserChanges: OperationalStudiesConfState = {
          ...rawOsrdconf,
          ...userChanges,
        };

        const expectedPacedTrainExceptions = [
          ...timetableItemToEditDataWithExceptions.originalPacedTrain.exceptions,
          {
            key: expect.any(String),
            occurrence_index: 2,
            rolling_stock_category: {
              value: {
                main_category: 'HIGH_SPEED_TRAIN',
              },
            },
            rolling_stock: {
              rolling_stock_name: 'DUAL-MODE_RS_E2Ee',
              comfort: 'HEATING',
            },
          },
        ];
        const result = formatPacedTrainPayload(
          osrdconfWithUserChanges,
          rollingStockName,
          timetableItemToEditDataWithExceptions
        );

        expect(result.exceptions).toEqual(expectedPacedTrainExceptions);
      });
    });

    describe('when the user modifies an added occurrence', () => {
      it('should update an existing exception if it was already present', () => {
        const userChanges: Partial<OperationalStudiesConfState> = {
          name: 'Added exception',
          pathSteps: [
            rawOsrdconf.pathSteps[0],
            {
              id: '1-1',
              deleted: false,
              location: {
                trigram: 'SS',
                secondary_code: 'BV',
                track_reference: null,
              },
              arrival: null,
              stopFor: Duration.parse('P0D'),
              receptionSignal: 'OPEN',
              locked: false,
            },
          ],
          // This is not user change but we need to updated this value so it matches the one from the added occurrence
          startTime: new Date('2025-06-02T14:30:00.000Z'),
        };
        const timetableItemToEditDataWithExceptions: TimetableItemToEditData = {
          ...rawTimetableItemToEditData,
          originalPacedTrain: {
            ...rawTimetableItemToEditData.originalPacedTrain,
            exceptions: [
              ...rawTimetableItemToEditData.originalPacedTrain.exceptions,
              {
                key: '987-654',
                start_time: { value: '2025-06-02T14:30:00.000Z' },
              },
            ],
          },
          occurrenceId: 'exception_238_987-654' as AddedExceptionId,
        };
        const osrdconfWithUserChanges: OperationalStudiesConfState = {
          ...rawOsrdconf,
          ...userChanges,
        };

        const expectedPacedTrainExceptions: PacedTrainException[] = [
          {
            key: '987-654',
            occurrence_index: undefined,
            start_time: { value: '2025-06-02T14:30:00.000Z' },
            train_name: {
              value: 'Added exception',
            },
            path_and_schedule: {
              path: [
                {
                  id: '0-0',
                  deleted: false,
                  trigram: 'WS',
                  secondary_code: 'BV',
                  track_reference: null,
                },
                {
                  id: '1-1',
                  deleted: false,
                  trigram: 'SS',
                  secondary_code: 'BV',
                  track_reference: null,
                },
              ],
              schedule: [
                {
                  at: '1-1',
                  arrival: undefined,
                  stop_for: 'P0D',
                  reception_signal: 'OPEN',
                  locked: false,
                },
              ],
              power_restrictions: [],
              margins: {
                boundaries: [],
                values: ['0%'],
              },
            },
          },
        ];
        const result = formatPacedTrainPayload(
          osrdconfWithUserChanges,
          rollingStockName,
          timetableItemToEditDataWithExceptions
        );

        expect(result.exceptions).toEqual(expectedPacedTrainExceptions);
      });
    });

    describe('when the user modifies occurrence at index 0', () => {
      it('should remove the exception if it matches back the original paced train', () => {
        const userChanges: Partial<OperationalStudiesConfState> = {
          speedLimitByTag: undefined,
          // These are not user changes but we need to updated these values so they match the ones from the occurrence at its specific index
          startTime: new Date('2025-06-02T12:45:00.000Z'), // occurrence with index 0 start time
          name: 'test 1', // occurrence with index 0 generated name
        };
        const timetableItemToEditDataWithExceptions: TimetableItemToEditData = {
          ...rawTimetableItemToEditData,
          originalPacedTrain: {
            ...rawTimetableItemToEditData.originalPacedTrain,
            exceptions: [
              ...rawTimetableItemToEditData.originalPacedTrain.exceptions,
              {
                key: '444-555',
                occurrence_index: 0,
                speed_limit_tag: {
                  value: 'V100',
                },
              },
            ],
          },
          occurrenceId: 'indexedoccurrence_238_0' as IndexedOccurrenceId,
        };
        const osrdconfWithUserChanges: OperationalStudiesConfState = {
          ...rawOsrdconf,
          ...userChanges,
        };
        const result = formatPacedTrainPayload(
          osrdconfWithUserChanges,
          rollingStockName,
          timetableItemToEditDataWithExceptions
        );

        expect(result.exceptions).toEqual([]);
      });
    });
  });
});
