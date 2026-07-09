import type { TFunction } from 'i18next';
import { describe, it, expect, vi } from 'vitest';

import { uniqueTrainHonored } from 'applications/operationalStudies/__tests__/sampleData';
import type { TimetableJsonPayload } from 'applications/operationalStudies/types';
import type { RoundTrips } from 'common/api/osrdEditoastApi';

import { buildTimetableExportPayload } from '../../../Timetable/utils';
import { processJsonFile } from '../parseJson';

// there seems to be no nice cast to make this mock
const tMock = vi.fn().mockImplementation(() => 'translated') as unknown as TFunction<
  'operational-studies',
  'importTrains'
>;

const buildTrainSchedule = (overrides: Record<string, unknown> = {}) => ({
  ...uniqueTrainHonored,
  ...overrides,
});

describe('processJsonFile', () => {
  const train0 = buildTrainSchedule({ train_name: 'train_0', id: 0 });
  const train1 = buildTrainSchedule({ train_name: 'train_1', id: 1 });

  describe('Export/Import of timetable', () => {
    it('Should export and import timetable', () => {
      const payloadTrains = [train0, train1];

      const payloadRoundTrips: RoundTrips = {
        round_trips: [[0, 1]],
      };
      const exportPayload = buildTimetableExportPayload(
        payloadTrains,
        payloadTrains.map(({ id }) => id),
        payloadRoundTrips
      );
      const importPayload = processJsonFile(
        JSON.stringify(exportPayload),
        'application/json',
        tMock
      );
      expect(importPayload).toEqual(
        expect.objectContaining({
          train_schedules: payloadTrains.map(
            ({ id: _id, train_schedule_set_id: _train_schedule_set_id, ...rest }) => rest
          ),
          round_trips: [[0, 1]],
        })
      );
    });
  });

  describe('round trips', () => {
    it('should keep one ways when importing valid JSON', () => {
      const payload: TimetableJsonPayload = {
        train_schedules: [train0],
        round_trips: [[0, null]],
      };

      const rawPayload = processJsonFile(JSON.stringify(payload), 'application/json', tMock);

      expect(rawPayload).toEqual(
        expect.objectContaining({
          round_trips: [[0, null]],
        })
      );
    });
    it('should keep round trips when importing valid JSON', () => {
      const payload: TimetableJsonPayload = {
        train_schedules: [train0, train1],
        round_trips: [[0, 1]],
      };

      const rawPayload = processJsonFile(JSON.stringify(payload), 'application/json', tMock);

      expect(rawPayload).toEqual(
        expect.objectContaining({
          round_trips: [[0, 1]],
        })
      );
    });

    it('should reject malformed round trip payloads', () => {
      const invalidPayload = {
        trains: [train0],
        round_trips: 'invalid',
      };
      expect(() =>
        processJsonFile(JSON.stringify(invalidPayload), 'application/json', tMock)
      ).toThrow();
    });
    it('should handle invalid json', () => {
      const invalidPayload = {
        trains: [0, 1],
        round_trips: {
          train_schedules: [[0, 1]],
        },
      };

      expect(() =>
        processJsonFile(JSON.stringify(invalidPayload), 'application/json', tMock)
      ).toThrow();
    });
  });
});
