import { expect, it } from 'vitest';

import type { PathStep } from 'reducers/osrdconf/types';

import formatSchedule from '../formatSchedule';

describe('formatSchedule', () => {
  describe('same day', () => {
    it('should ignore steps without arrival or stopFor', () => {
      const pathSteps = [
        {
          id: 'id331',
          deleted: false,
          uic: 8706,
          ch: 'BV',
          kp: '130+538',
          name: 'G',
          positionOnPath: 0,
        },
      ] as PathStep[];
      const result = formatSchedule(pathSteps);
      expect(result?.length).toBe(0);
    });
    it('should format the train schedule', () => {
      const pathSteps = [
        {
          id: 'id332',
          deleted: false,
          uic: 8737,
          ch: 'BV',
          kp: '117+422',
          name: 'V',
          positionOnPath: 13116000,
          arrival: 'PT60S',
          stopFor: '0',
          locked: false,
          onStopSignal: false,
        },
      ] as PathStep[];
      const result = formatSchedule(pathSteps);
      expect(result).toEqual([
        {
          arrival: 'PT60S',
          at: 'id332',
          locked: false,
          on_stop_signal: false,
          stop_for: 'PT0S',
        },
      ]);
    });
  });
});
