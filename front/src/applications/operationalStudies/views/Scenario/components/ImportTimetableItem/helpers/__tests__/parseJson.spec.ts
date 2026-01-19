import type { TFunction } from 'i18next';
import { describe, it, expect, vi } from 'vitest';

import { trainScheduleHonored } from 'applications/operationalStudies/__tests__/sampleData';

import { processJsonFile } from '../parseJson';

// there seems to be no nice cast to make this mock
const tMock = vi.fn().mockImplementation(() => 'translated') as unknown as TFunction<
  'operational-studies',
  'importTrains'
>;

const buildTrainSchedule = (overrides: Record<string, unknown> = {}) => ({
  ...trainScheduleHonored,
  ...overrides,
});

describe('processJsonFile', () => {
  const train0 = buildTrainSchedule({ train_name: 'train 0' });
  const train1 = buildTrainSchedule({ train_name: 'train 1' });
  describe('round trips', () => {
    it('should keep one ways when importing valid JSON', () => {
      const payload = {
        train_schedules: [train0],
        paced_trains: [],
        round_trips: {
          train_schedules: [[0, null]],
          paced_trains: [],
        },
      };

      const rawPayload = processJsonFile(JSON.stringify(payload), 'application/json', tMock);

      expect(rawPayload).toEqual(
        expect.objectContaining({
          round_trips: {
            train_schedules: [[0, null]],
            paced_trains: [],
          },
        })
      );
    });
    it('should keep round trips when importing valid JSON', () => {
      const payload = {
        train_schedules: [train0, train1],
        paced_trains: [],
        round_trips: {
          train_schedules: [[0, 1]],
          paced_trains: [],
        },
      };

      const rawPayload = processJsonFile(JSON.stringify(payload), 'application/json', tMock);

      expect(rawPayload).toEqual(
        expect.objectContaining({
          round_trips: {
            train_schedules: [[0, 1]],
            paced_trains: [],
          },
        })
      );
    });

    it('should reject malformed round trip payloads', () => {
      const invalidPayload = {
        train_schedules: [train0],
        paced_trains: [],
        round_trips: 'invalid',
      };
      expect(() =>
        processJsonFile(JSON.stringify(invalidPayload), 'application/json', tMock)
      ).toThrow();
    });
    it('should handle invalid json', () => {
      const invalidPayload = {
        train_schedules: [0, 1],
        paced_trains: [],
        round_trips: {
          train_schedules: [[0, 1]],
          paced_trains: [],
        },
      };

      expect(() =>
        processJsonFile(JSON.stringify(invalidPayload), 'application/json', tMock)
      ).toThrow();
    });
  });
});
