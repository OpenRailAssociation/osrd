import { describe, it, expect } from 'vitest';

import type { TrainScheduleResponse } from 'common/api/osrdEditoastApi';

import { getScenarioDatetimeWindow } from '../utils';

describe('getScenarioDatetimeWindow', () => {
  it('should return undefined if trainsDetails is empty', () => {
    const result = getScenarioDatetimeWindow([]);
    const expected = {
      begin: new Date(new Date().setHours(0, 0, 0, 0)),
      end: new Date(new Date().setHours(23, 59, 59, 999)),
    };
    expect(result).toEqual(expected);
  });

  it('should return the correct begin and end dates', () => {
    const trainsDetails = [
      { start_time: '2023-10-01T10:00:00Z' },
      { start_time: '2023-10-01T12:00:00Z' },
      { start_time: '2023-10-01T08:00:00Z' },
    ];

    const result = getScenarioDatetimeWindow(trainsDetails as TrainScheduleResponse[]);

    expect(result).toEqual({
      begin: new Date('2023-10-01T08:00:00Z'),
      end: new Date('2023-10-01T12:00:00Z'),
    });
  });

  it('should handle a single train detail correctly', () => {
    const trainsDetails = [{ start_time: '2023-10-01T10:00:00Z' }];

    const result = getScenarioDatetimeWindow(trainsDetails as TrainScheduleResponse[]);

    expect(result).toEqual({
      begin: new Date('2023-10-01T10:00:00Z'),
      end: new Date('2023-10-01T10:00:00Z'),
    });
  });
});
