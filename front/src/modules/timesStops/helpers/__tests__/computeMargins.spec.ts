import { describe, it, expect } from 'vitest';

import type { ScheduleItem, TrainScheduleResponse } from 'common/api/osrdEditoastApi';

import { MarginUnit } from '../../consts';
import type { TheoreticalMarginsRecord } from '../../types';
import { computeMargins, getTheoreticalMargins } from '../computeMargins';

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

describe('computeMargins without pathItemTimes (reference_base_arrival based)', () => {
  const path = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];
  const margins = { boundaries: ['a'], values: ['10%'] };
  const train = { path, margins } as unknown as TrainScheduleResponse;

  it('computes provisional lost time from the start of the path when pathStepIndex is 0', () => {
    const theoreticalMargins: TheoreticalMarginsRecord = {
      a: { theoreticalMargin: '10%', isBoundary: true },
      b: { theoreticalMargin: '10%', isBoundary: false },
      c: { theoreticalMargin: '10%', isBoundary: false },
      d: { theoreticalMargin: '10%', isBoundary: false },
    };
    const scheduleByAt: Record<string, ScheduleItem> = {
      b: { at: 'b', arrival: 'PT12M', reference_base_arrival: 'PT10M' },
    };

    const result = computeMargins(theoreticalMargins, train, scheduleByAt, 0, undefined);

    // finalLostTime = 12min - 10min = 120s
    // provisionalLostTime = 10min (600s) * 10% = 60s, since pathStepIndex is 0
    expect(result).toEqual({
      theoreticalMargin: { value: 10, unit: MarginUnit.percent },
      isTheoreticalMarginBoundary: true,
      theoreticalMarginSeconds: { value: 60, unit: MarginUnit.second },
      calculatedMargin: { value: 120, unit: MarginUnit.second },
      diffMargins: { value: 60, unit: MarginUnit.second },
    });
  });

  it('computes provisional lost time from the previous step reference_base_arrival otherwise', () => {
    const theoreticalMargins: TheoreticalMarginsRecord = {
      a: { theoreticalMargin: '10%', isBoundary: true },
      b: { theoreticalMargin: '20%', isBoundary: true },
      c: { theoreticalMargin: '20%', isBoundary: false },
      d: { theoreticalMargin: '20%', isBoundary: false },
    };
    const scheduleByAt: Record<string, ScheduleItem> = {
      b: { at: 'b', reference_base_arrival: 'PT5M' },
      d: { at: 'd', arrival: 'PT25M', reference_base_arrival: 'PT20M' },
    };

    const result = computeMargins(theoreticalMargins, train, scheduleByAt, 1, undefined);

    // finalLostTime = 25min - 20min = 300s
    // provisionalLostTime = (20min - 5min) * 20% = 900s * 0.2 = 180s
    expect(result).toEqual({
      theoreticalMargin: { value: 20, unit: MarginUnit.percent },
      isTheoreticalMarginBoundary: true,
      theoreticalMarginSeconds: { value: 180, unit: MarginUnit.second },
      calculatedMargin: { value: 300, unit: MarginUnit.second },
      diffMargins: { value: 120, unit: MarginUnit.second },
    });
  });
});
