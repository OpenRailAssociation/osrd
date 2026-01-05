import type { TFunction } from 'i18next';
import { describe, it, expect, vi } from 'vitest';

import { trainScheduleHonored } from 'applications/operationalStudies/helpers/__tests__/sampleData';
import { setFailure } from 'reducers/main';

import { processJsonFile } from '../handleParseFiles';

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
      const setTrainsJsonData = vi.fn();
      const dispatch = vi.fn();

      const payload = {
        train_schedules: [train0],
        paced_trains: [],
        round_trips: {
          train_schedules: [[0, null]],
          paced_trains: [],
        },
      };

      processJsonFile(
        JSON.stringify(payload),
        'application/json',
        setTrainsJsonData,
        dispatch,
        tMock
      );

      expect(setTrainsJsonData).toHaveBeenCalledWith(
        expect.objectContaining({
          round_trips: {
            train_schedules: [[0, null]],
            paced_trains: [],
          },
        })
      );
      expect(dispatch).not.toHaveBeenCalled();
    });
    it('should keep round trips when importing valid JSON', () => {
      const setTrainsJsonData = vi.fn();
      const dispatch = vi.fn();

      const payload = {
        train_schedules: [train0, train1],
        paced_trains: [],
        round_trips: {
          train_schedules: [[0, 1]],
          paced_trains: [],
        },
      };

      processJsonFile(
        JSON.stringify(payload),
        'application/json',
        setTrainsJsonData,
        dispatch,
        tMock
      );

      expect(setTrainsJsonData).toHaveBeenCalledWith(
        expect.objectContaining({
          round_trips: {
            train_schedules: [[0, 1]],
            paced_trains: [],
          },
        })
      );
      expect(dispatch).not.toHaveBeenCalled();
    });

    it('should reject malformed round trip payloads', () => {
      const setTrainsJsonData = vi.fn();
      const dispatch = vi.fn();

      const invalidPayload = {
        train_schedules: [train0],
        paced_trains: [],
        round_trips: 'invalid',
      };

      processJsonFile(
        JSON.stringify(invalidPayload),
        'application/json',
        setTrainsJsonData,
        dispatch,
        tMock
      );

      expect(setTrainsJsonData).not.toHaveBeenCalled();
      expect(dispatch).toHaveBeenCalledTimes(1);
      expect(dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: setFailure.type,
        })
      );
    });
    it('should handle invalid json', () => {
      const setTrainsJsonData = vi.fn();
      const dispatch = vi.fn();

      const invalidPayload = {
        train_schedules: [0, 1],
        paced_trains: [],
        round_trips: {
          train_schedules: [[0, 1]],
          paced_trains: [],
        },
      };

      processJsonFile(
        JSON.stringify(invalidPayload),
        'application/json',
        setTrainsJsonData,
        dispatch,
        tMock
      );

      expect(setTrainsJsonData).not.toHaveBeenCalled();
      expect(dispatch).toHaveBeenCalledTimes(1);
      expect(dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: setFailure.type,
        })
      );
    });
  });
});
