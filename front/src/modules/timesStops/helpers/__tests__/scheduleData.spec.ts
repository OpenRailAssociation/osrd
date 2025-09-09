import { describe, it, expect } from 'vitest';

import type { ReceptionSignal } from 'common/api/osrdEditoastApi';
import { Duration } from 'utils/duration';

import { formatSchedule } from '../scheduleData';

describe('formatScheduleTime', () => {
  it('should return empty objecty if schedule is undefined', () => {
    const arrivalTime = new Date();

    expect(formatSchedule(arrivalTime, undefined)).toEqual({
      stopFor: undefined,
      shortSlipDistance: false,
      onStopSignal: false,
      calculatedDeparture: undefined,
    });
  });

  it('should compute simple arrival time in the correct timezone', () => {
    const arrivalTime = new Date('2022-01-01T02:03:00');
    const schedule = {
      at: 'id325',
      stop_for: 'PT100S',
      reception_signal: 'OPEN' as ReceptionSignal,
    };

    expect(formatSchedule(arrivalTime, schedule)).toEqual({
      calculatedDeparture: new Date('2022-01-01T02:04:40'),
      stopFor: new Duration({ seconds: 100 }),
      shortSlipDistance: false,
      onStopSignal: false,
    });
  });
});
