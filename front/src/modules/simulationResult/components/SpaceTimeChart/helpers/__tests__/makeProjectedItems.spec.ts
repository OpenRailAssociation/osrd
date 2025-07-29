import dayjs from 'dayjs';
import { describe, expect, test } from 'vitest';

import { type TrainSpaceTimeData } from 'modules/simulationResult/types';
import type { PacedTrainId } from 'reducers/osrdconf/types';
import { Duration } from 'utils/duration';

import makeProjectedItems from '../makeProjectedItems';

describe('makeProjectedItems', () => {
  describe('paced train with indexed 2 occurrences, 2nd’s is a path exception', () => {
    const exceptionKey = '9f11f34a-8ece-42bc-ac3f-45a8ab19f5ec';
    const exception = {
      key: exceptionKey,
      occurrence_index: 1,
      disabled: false,
      train_name: {
        value: 'GE brg 3',
      },
      path_and_schedule: {
        path: [
          {
            id: 'a496f3a6-4eea-45f8-a83c-5472d9adcd6d',
            uic: 11,
            secondary_code: 'BV',
          },
          {
            id: 'e18f50f3-2b40-451e-9726-e4dd29459bf0',
            uic: 12,
            secondary_code: 'BV',
          },
        ],
        schedule: [
          {
            at: 'e18f50f3-2b40-451e-9726-e4dd29459bf0',
            stop_for: 'P0D',
          },
        ],
        margins: {
          boundaries: [],
          values: ['0%'],
        },
        power_restrictions: [],
      },
    };

    const exceptionProjection = {
      spaceTimeCurves: [
        {
          positions: [0, 3600],
          times: [0, 2000],
        },
        {
          positions: [36531000, 36562976],
          times: [2444760, 2446849],
        },
      ],
      signalUpdates: [],
    };

    const projectPathTrainResult: TrainSpaceTimeData[] = [
      {
        name: 'GE LYD',
        departureTime: new Date('2025-07-09T05:30:00.000Z'),
        id: 'paced_2562' as PacedTrainId,
        paced: {
          timeWindow: Duration.parse('PT2H'),
          interval: Duration.parse('PT1H'),
        },
        spaceTimeCurves: [
          {
            positions: [0, 2408],
            times: [0, 2000],
          },
        ],
        signalUpdates: [
          {
            signal_id: 'c40477be-4964-11e4-9bff-012064e0362d',
            signaling_system: 'BAL',
            time_start: 0,
            time_end: 28510,
            position_start: 206000,
            position_end: 512000,
            color: -16711936,
            blinking: false,
            aspect_label: 'VL',
          },
        ],
        exceptions: [exception],
        exceptionProjections: new Map([[exceptionKey, exceptionProjection]]),
      },
    ];

    test('first occurrence should use paced train projection, second occurrence should use its own projection', () => {
      const pacedTrain = projectPathTrainResult[0];

      const result = makeProjectedItems(projectPathTrainResult);

      expect(result[0]).toEqual({
        id: 'indexedoccurrence_2562_0',
        name: `${pacedTrain.name} 1`,
        departureTime: pacedTrain.departureTime,
        spaceTimeCurves: pacedTrain.spaceTimeCurves,
        signalUpdates: pacedTrain.signalUpdates,
      });
      expect(result[1]).toEqual({
        id: 'indexedoccurrence_2562_1',
        name: exception.train_name.value,
        departureTime: new Date('2025-07-09T06:30:00.000Z'),
        exception,
        ...exceptionProjection,
      });
    });
  });

  describe('paced train with 1 ADDED path exception', () => {
    const exceptionKey = 'a057a742-ec2f-401e-adb1-558017f20d74';
    const exception = {
      key: exceptionKey,
      path_and_schedule: {
        margins: {
          boundaries: [],
          values: ['0%'],
        },
        path: [
          {
            id: '3e6c78c6-89a9-462f-a0b3-1e4253cb6386',
            uic: 11,
            secondary_code: 'BV',
            deleted: false,
          },
          {
            id: '00fd1b82-32ca-43fd-a46e-24b5bc6f0fd3',
            uic: 14,
            secondary_code: 'BV',
            deleted: false,
          },
        ],
        power_restrictions: [],
        schedule: [
          {
            at: '00fd1b82-32ca-43fd-a46e-24b5bc6f0fd3',
            stop_for: 'P0D',
          },
        ],
      },
      start_time: {
        value: '2025-07-30T14:00:00.000Z',
      },
      train_name: {
        value: 'GE VPE +',
      },
    };

    const exceptionProjection = {
      spaceTimeCurves: [
        {
          positions: [0, 2408, 8726, 17630, 28475],
          times: [0, 2000, 4000, 6000, 8000],
        },
        {
          positions: [3747000, 4062674, 4370040, 5094361, 5568162],
          times: [276550, 292849, 308849, 348849, 374849],
        },
      ],
      signalUpdates: [],
    };

    const projectPathTrainResult: TrainSpaceTimeData[] = [
      {
        name: 'auie',
        departureTime: new Date('2025-07-09T05:30:00.000Z'),
        spaceTimeCurves: [
          {
            positions: [0, 2408, 8726, 17630, 40899],
            times: [0, 2000, 4000, 6000, 10000],
          },
        ],
        signalUpdates: [],
        id: 'paced_2564' as PacedTrainId,
        paced: {
          timeWindow: Duration.parse('PT3H'),
          interval: Duration.parse('PT1H'),
        },
        exceptions: [exception],
        exceptionProjections: new Map([[exceptionKey, exceptionProjection]]),
      },
    ];

    test('added path exception should use its own projection', () => {
      const pacedTrain = projectPathTrainResult[0];

      const result = makeProjectedItems(projectPathTrainResult);

      expect(result.length).toBe(4);
      expect(result[0]).toEqual({
        id: 'indexedoccurrence_2564_0',
        name: 'auie 1',
        departureTime: pacedTrain.departureTime,
        spaceTimeCurves: pacedTrain.spaceTimeCurves,
        signalUpdates: pacedTrain.signalUpdates,
      });
      expect(result[1]).toEqual({
        id: 'indexedoccurrence_2564_1',
        name: `${pacedTrain.name} 3`,
        departureTime: dayjs(pacedTrain.departureTime).add(1, 'hour').toDate(),
        spaceTimeCurves: pacedTrain.spaceTimeCurves,
        signalUpdates: pacedTrain.signalUpdates,
      });
      expect(result[2]).toEqual({
        id: 'indexedoccurrence_2564_2',
        name: `${pacedTrain.name} 5`,
        departureTime: dayjs(pacedTrain.departureTime).add(2, 'hour').toDate(),
        spaceTimeCurves: pacedTrain.spaceTimeCurves,
        signalUpdates: pacedTrain.signalUpdates,
      });
      expect(result[3]).toEqual({
        id: 'exception_2564_a057a742-ec2f-401e-adb1-558017f20d74',
        name: exception.train_name.value,
        departureTime: new Date(exception.start_time.value),
        exception,
        ...exceptionProjection,
      });
    });
  });
});
