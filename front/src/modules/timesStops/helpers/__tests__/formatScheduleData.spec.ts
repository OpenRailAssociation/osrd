import { describe, it, expect } from 'vitest';

import formatScheduleData from '../formatScheduleData';

describe('formatScheduleData', () => {
  it('should compute simple arrival time in the correct timezone', () => {
    const schedule = {
      at: 'id325',
      arrival: 'PT3600S',
      stop_for: 'PT100S',
      on_stop_signal: false,
      locked: false,
    };
    const startTime = '2024-05-14T00:00:00Z';

    expect(formatScheduleData(schedule, startTime)).toEqual({
      arrival: '01:00:00',
      departure: '01:01:40',
      stopFor: '100',
    });
  });
});
