import { describe, expect, it } from 'vitest';

import type { PathStep } from 'reducers/osrdconf/types';
import { Duration } from 'utils/duration';

import formatSchedule from '../formatSchedule';

describe('formatSchedule', () => {
  describe('same day', () => {
    it('should ignore steps without arrival or stopFor', () => {
      const pathSteps: PathStep[] = [
        {
          key: 'id331',
          location: {
            type: 'operational_point_part_reference',
            operational_point: { uic: 8706, secondary_code: 'BV', type: 'uic' },
          },
          kp: '130+538',
          name: 'G',
          positionOnPath: 0,
        },
      ];
      const result = formatSchedule(pathSteps);
      expect(result?.length).toBe(0);
    });
    it("should format the train's schedule field", () => {
      const pathSteps: PathStep[] = [
        {
          key: 'id332',
          location: {
            type: 'operational_point_part_reference',
            operational_point: { uic: 8737, secondary_code: 'BV', type: 'uic' },
          },
          kp: '117+422',
          name: 'V',
          positionOnPath: 13116000,
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
