import { describe, expect, it } from 'vitest';

import type { TimetableJsonPayload } from 'applications/operationalStudies/types';
import { Duration } from 'utils/duration';

import { toHourlyPattern } from '../adaptImportedTrains';

const HOURLY_DURATION = new Duration({ hours: 2 });
const TEST_DATE = new Date('2026-01-05T08:37:00Z').getTime();

const paced = (interval: string, timeWindow: string, exceptions: unknown[] = []) => ({
  interval,
  time_window: timeWindow,
  exceptions,
});

const createTrain = (overrides: Record<string, unknown> = {}) =>
  ({
    train_name: 'X',
    rolling_stock_name: 'RS',
    constraint_distribution: 'STANDARD',
    path: [],
    schedule: [],
    start_time: TEST_DATE,
    paced: null,
    ...overrides,
  }) as TimetableJsonPayload['train_schedules'][number];

describe('toHourlyPattern', () => {
  describe('Import a file with only unique trains', () => {
    it('Transforms a unique train into a mission', () => {
      const hourly = toHourlyPattern(createTrain(), HOURLY_DURATION);
      expect(hourly.paced).toEqual(paced('PT2H', 'PT2H'));
    });

    it('Folds the start date into an offset the database accepts', () => {
      const hourly = toHourlyPattern(createTrain(), HOURLY_DURATION);
      expect(hourly.start_time).toBe(new Duration({ minutes: 37 }).ms);
    });
  });

  describe('Import a file with paced trains', () => {
    it('Keeps the determined interval from xml file and takes the pattern duration', () => {
      // The exported time window is an artefact of what the file happens to contain,
      // unlike the interval, which the parser determined from the occurrences
      const train = createTrain({ paced: paced('PT30M', 'PT3H') });
      const hourly = toHourlyPattern(train, HOURLY_DURATION);
      expect(hourly.paced).toEqual(paced('PT30M', 'PT2H'));
    });

    it('Removes exceptions from imported xml file', () => {
      const train = createTrain({
        paced: paced('PT30M', 'PT3H', [
          { key: 'a', start_time: { value: TEST_DATE } },
          { key: 'b', train_name: { value: 'renamed' } },
        ]),
      });
      const hourly = toHourlyPattern(train, HOURLY_DURATION);
      expect(hourly.paced!.exceptions).toEqual([]);
    });

    it('Folds the start time into the interval', () => {
      // The database enforces 0 <= start_time < interval, which is the stricter bound
      const train = createTrain({ paced: paced('PT30M', 'PT3H') });
      const hourly = toHourlyPattern(train, HOURLY_DURATION);
      // 08:37 UTC would give a 37 min offset, which is past the 30 min interval.
      // It has to be folded into the interval (7 min offset)
      expect(hourly.start_time).toBe(new Duration({ minutes: 7 }).ms);
    });

    it('Limits the determined interval to the pattern duration', () => {
      // The database also requires interval <= time_window
      const train = createTrain({ paced: paced('PT4H', 'PT4H') });
      const hourly = toHourlyPattern(train, HOURLY_DURATION);
      expect(hourly.paced!.interval).toBe('PT2H');
    });
  });
});
