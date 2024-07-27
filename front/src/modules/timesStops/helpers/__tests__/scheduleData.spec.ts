import { describe, it, expect } from 'vitest';

import { computeScheduleData } from '../scheduleData';

describe('computeScheduleData', () => {
  it('should compute simple arrival time in the correct timezone', () => {
    const schedule = {
      at: 'id325',
      arrival: 'PT3600S',
      stop_for: 'PT100S',
      on_stop_signal: false,
      locked: false,
    };
    const startTime = '2024-05-14T00:00:00Z';

    expect(computeScheduleData(schedule, startTime)).toEqual({
      arrival: 3600,
      departure: 3700,
      stopFor: 100,
    });
  });
});
