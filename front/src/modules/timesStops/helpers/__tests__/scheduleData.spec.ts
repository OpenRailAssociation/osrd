import { describe, it, expect } from 'vitest';

import type { ReceptionSignal } from 'common/api/osrdEditoastApi';

import { computeScheduleData } from '../scheduleData';

describe('computeScheduleData', () => {
  describe('same day', () => {
    it('should compute simple arrival time in the correct timezone', () => {
      const schedule = {
        at: 'id325',
        arrival: 'PT3600S',
        stop_for: 'PT100S',
        reception_signal: 'OPEN' as ReceptionSignal,
        locked: false,
      };

      expect(computeScheduleData(schedule)).toEqual({
        arrival: 3600,
        departure: 3700,
        stopFor: 100,
      });
    });
  });
});
