import { describe, expect, it } from 'vitest';

import type { PathStep } from 'reducers/osrdconf/types';
import { Duration } from 'utils/duration';

import formatSchedule from '../formatSchedule';

describe('formatSchedule', () => {
  describe('same day', () => {
    it('should ignore steps without arrival or stopFor', () => {
      const pathSteps: PathStep[] = [
        {
          id: 'id331',
          location: {
            type: 'operational_point_part_reference',
            operational_point: { uic: 8706, secondary_code: 'BV', type: 'uic' },
          },
          arrival: null,
          stopFor: null,
          theoreticalMargin: null,
          receptionSignal: null,
        },
      ];
      const result = formatSchedule(pathSteps);
      expect(result?.length).toBe(0);
    });
    it("should format the train's schedule field", () => {
      const pathSteps: PathStep[] = [
        {
          id: 'id332',
          location: {
            type: 'operational_point_part_reference',
            operational_point: { uic: 8737, secondary_code: 'BV', type: 'uic' },
          },
          theoreticalMargin: null,
          arrival: Duration.parse('PT60S'),
          stopFor: Duration.zero,
          receptionSignal: 'OPEN',
        },
      ];
      const result = formatSchedule(pathSteps);
      expect(result).toEqual([
        {
          arrival: 'PT1M',
          at: 'id332',
          reception_signal: 'OPEN',
          stop_for: 'PT0S',
        },
      ]);
    });
  });
});
