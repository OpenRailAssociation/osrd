import { keyBy } from 'lodash';
import { describe, it, expect } from 'vitest';

import type { ScheduleEntry } from 'modules/timesStops/types';
import type { TimetableItem } from 'reducers/osrdconf/types';

import computeMargins, { getTheoreticalMargins } from '../computeMargins';

describe('computeMargins', () => {
  const path = [
    {
      id: 'a',
      uic: 1,
    },
    {
      id: 'b',
      uic: 2,
    },
    {
      id: 'c',
      uic: 3,
    },
    {
      id: 'd',
      uic: 4,
    },
    {
      id: 'e',
      uic: 5,
    },
  ];
  const margins = { boundaries: ['c'], values: ['10%', '5%'] };
  const pathItemTimes = {
    base: [0, 100 * 1000, 200 * 1000, 400 * 1000, 500 * 1000],
    provisional: [0, 110 * 1000, 220 * 1000, 430 * 1000, 535 * 1000],
    final: [0, 115 * 1000, 230 * 1000, 440 * 1000, 545 * 1000],
  };
  const schedule = [
    {
      at: 'a',
    },
    {
      at: 'c',
    },
    {
      at: 'd',
    },
    {
      at: 'e',
    },
  ];

  it('should compute simple margin', () => {
    const train = { path, margins, schedule } as TimetableItem;
    const scheduleByAt: Record<string, ScheduleEntry> = keyBy(train.schedule, 'at');
    const theoreticalMargins = getTheoreticalMargins(train);
    expect(computeMargins(theoreticalMargins, train, scheduleByAt, 0, pathItemTimes)).toEqual({
      theoreticalMargin: '10 %',
      isTheoreticalMarginBoundary: true,
      theoreticalMarginSeconds: '20 s',
      calculatedMargin: '30 s',
      diffMargins: '10 s',
    });
    expect(computeMargins(theoreticalMargins, train, scheduleByAt, 1, pathItemTimes)).toEqual({
      theoreticalMargin: undefined,
      isTheoreticalMarginBoundary: undefined,
      theoreticalMarginSeconds: undefined,
      calculatedMargin: undefined,
      diffMargins: undefined,
    });
    expect(computeMargins(theoreticalMargins, train, scheduleByAt, 2, pathItemTimes)).toEqual({
      theoreticalMargin: '5 %',
      isTheoreticalMarginBoundary: true,
      theoreticalMarginSeconds: '15 s',
      calculatedMargin: '15 s',
      diffMargins: '0 s',
    });
    expect(computeMargins(theoreticalMargins, train, scheduleByAt, 3, pathItemTimes)).toEqual({
      theoreticalMargin: undefined,
      isTheoreticalMarginBoundary: undefined,
      theoreticalMarginSeconds: undefined,
      calculatedMargin: undefined,
      diffMargins: undefined,
    });
    expect(computeMargins(theoreticalMargins, train, scheduleByAt, 4, pathItemTimes)).toEqual({
      theoreticalMargin: undefined,
      isTheoreticalMarginBoundary: undefined,
      theoreticalMarginSeconds: undefined,
      calculatedMargin: undefined,
      diffMargins: undefined,
    });
  });
});

describe('getTheoreticalMargins', () => {
  it('should compute theoretical margins with boundaries correctly', () => {
    const path = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }, { id: 'e' }];
    const margins = { boundaries: ['c', 'd'], values: ['10%', '0%', '10 min/100km'] };
    const trainSchedule = { path, margins } as TimetableItem;

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
