import { describe, it, expect } from 'vitest';

import type { TrainScheduleResponse } from 'common/api/osrdEditoastApi';

import { getTheoreticalMargins } from '../computeMargins';

describe('getTheoreticalMargins', () => {
  it('should compute theoretical margins with boundaries correctly', () => {
    const path = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }, { id: 'e' }];
    const margins = { boundaries: ['c', 'd'], values: ['10%', '0%', '10 min/100km'] };
    const trainSchedule = { path, margins } as TrainScheduleResponse;

    const theoreticalMargins = getTheoreticalMargins(trainSchedule);

    expect(theoreticalMargins).toEqual({
      a: { theoreticalMargin: '10%', isBoundary: true },
      b: { theoreticalMargin: '10%', isBoundary: false },
      c: { theoreticalMargin: '0%', isBoundary: true },
      d: { theoreticalMargin: '10 min/100km', isBoundary: true },
      e: { theoreticalMargin: '10 min/100km', isBoundary: false },
    });
  });
});
