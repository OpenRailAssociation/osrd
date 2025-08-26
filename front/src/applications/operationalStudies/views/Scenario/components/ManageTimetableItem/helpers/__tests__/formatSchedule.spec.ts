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
          deleted: false,
          uic: 8706,
          secondary_code: 'BV',
          kp: '130+538',
          name: 'G',
          positionOnPath: 0,
        },
      ];
      const result = formatSchedule(pathSteps);
      expect(result?.length).toBe(0);
    });
    it('should format the train schedule', () => {
      const pathSteps: PathStep[] = [
        {
          id: 'id332',
          deleted: false,
          uic: 8737,
          secondary_code: 'BV',
          kp: '117+422',
          name: 'V',
          positionOnPath: 13116000,
          arrival: Duration.parse('PT60S'),
          stopFor: Duration.zero,
          locked: false,
          receptionSignal: 'OPEN',
        },
      ];
      const result = formatSchedule(pathSteps);
      expect(result).toEqual([
        {
          arrival: 'PT1M',
          at: 'id332',
          locked: false,
          reception_signal: 'OPEN',
          stop_for: 'P0D',
        },
      ]);
    });
  });
});
