import { describe, it } from 'vitest';

import type { TrainScheduleResult } from 'common/api/osrdEditoastApi';

import { getScenarioDatetimeWindow } from '../utils';

describe('getScenarioDatetimeWindow', () => {
  it('should return undefined if trainsDetails is empty', () => {
    const result = getScenarioDatetimeWindow([]);
    expect(result).toBeUndefined();
  });

  it('should return the correct begin and end dates', () => {
    const trainsDetails = [
      { start_time: '2023-10-01T10:00:00Z' },
      { start_time: '2023-10-01T12:00:00Z' },
      { start_time: '2023-10-01T08:00:00Z' },
    ];

    const result = getScenarioDatetimeWindow(trainsDetails as TrainScheduleResult[]);

    expect(result).toEqual({
      begin: new Date('2023-10-01T08:00:00Z'),
      end: new Date('2023-10-01T12:00:00Z'),
    });
  });

  it('should handle a single train detail correctly', () => {
    const trainsDetails = [{ start_time: '2023-10-01T10:00:00Z' }];

    const result = getScenarioDatetimeWindow(trainsDetails as TrainScheduleResult[]);

    expect(result).toEqual({
      begin: new Date('2023-10-01T10:00:00Z'),
      end: new Date('2023-10-01T10:00:00Z'),
    });
  });
});
