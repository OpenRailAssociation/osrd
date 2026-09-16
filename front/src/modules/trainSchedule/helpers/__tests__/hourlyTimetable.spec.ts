import { describe, it, expect } from 'vitest';

import type { TrainScheduleResponse } from 'common/api/osrdEditoastApi';
import { Duration } from 'utils/duration';

import {
  computeHourlyTimetableDuration,
  DEFAULT_HOURLY_TIMETABLE_DURATION,
  wrapHourlyExceptionStartTimes,
  wrapHourlyStartTime,
} from '../hourlyTimetable';

const baseTrainSchedule: TrainScheduleResponse = {
  id: 0,
  train_schedule_set_id: 0,
  train_name: 'test',
  rolling_stock_name: 'test',
  constraint_distribution: 'STANDARD',
  start_time: 0,
  path: [],
};

const buildPacedTrain = (timeWindow: string): TrainScheduleResponse => ({
  ...baseTrainSchedule,
  id: 1,
  paced: {
    exceptions: [],
    interval: 'PT30M',
    time_window: timeWindow,
  },
});

const buildUniqueTrain = (): TrainScheduleResponse => ({
  ...baseTrainSchedule,
  id: 2,
});

describe('computeHourlyTimetableDuration', () => {
  it('should return the default duration for an empty timetable', () => {
    expect(computeHourlyTimetableDuration([])).toEqual(DEFAULT_HOURLY_TIMETABLE_DURATION);
  });

  it('should return the paced train duration when there is a single paced train', () => {
    expect(computeHourlyTimetableDuration([buildPacedTrain('PT2H')])).toEqual(
      new Duration({ hours: 2 })
    );
  });

  it('should compute the LCM of the paced train durations (2h and 3h -> 6h)', () => {
    expect(
      computeHourlyTimetableDuration([buildPacedTrain('PT2H'), buildPacedTrain('PT3H')])
    ).toEqual(new Duration({ hours: 6 }));
  });

  it('should compute the LCM of several paced train durations (2h, 3h and 4h -> 12h)', () => {
    expect(
      computeHourlyTimetableDuration([
        buildPacedTrain('PT2H'),
        buildPacedTrain('PT3H'),
        buildPacedTrain('PT4H'),
      ])
    ).toEqual(new Duration({ hours: 12 }));
  });

  it('should ignore unique (non-paced) train schedules', () => {
    expect(computeHourlyTimetableDuration([buildPacedTrain('PT2H'), buildUniqueTrain()])).toEqual(
      new Duration({ hours: 2 })
    );
  });

  it('should return the default duration when there is no paced train', () => {
    expect(computeHourlyTimetableDuration([buildUniqueTrain()])).toEqual(
      DEFAULT_HOURLY_TIMETABLE_DURATION
    );
  });

  it('should accept a resulting duration of exactly 24h', () => {
    expect(
      computeHourlyTimetableDuration([buildPacedTrain('PT8H'), buildPacedTrain('PT12H')])
    ).toEqual(new Duration({ hours: 24 }));
  });

  it('should return the resulting duration even when it exceeds 24h (5h and 7h -> 35h)', () => {
    expect(
      computeHourlyTimetableDuration([buildPacedTrain('PT5H'), buildPacedTrain('PT7H')])
    ).toEqual(new Duration({ hours: 35 }));
  });
});

describe('wrapHourlyStartTime', () => {
  const interval = new Duration({ minutes: 30 });

  it('should leave a start time already inside the interval untouched', () => {
    expect(wrapHourlyStartTime(new Duration({ minutes: 10 }).ms, interval)).toBe(
      new Duration({ minutes: 10 }).ms
    );
  });

  it('should wrap a negative start time to the end of the interval', () => {
    expect(wrapHourlyStartTime(new Duration({ minutes: -10 }).ms, interval)).toBe(
      new Duration({ minutes: 20 }).ms
    );
  });

  it('should wrap a start time beyond the interval', () => {
    expect(wrapHourlyStartTime(new Duration({ minutes: 50 }).ms, interval)).toBe(
      new Duration({ minutes: 20 }).ms
    );
  });

  it('should wrap a start time several intervals away', () => {
    expect(wrapHourlyStartTime(new Duration({ hours: -3, minutes: -10 }).ms, interval)).toBe(
      new Duration({ minutes: 20 }).ms
    );
    expect(wrapHourlyStartTime(new Duration({ hours: 3, minutes: 20 }).ms, interval)).toBe(
      new Duration({ minutes: 20 }).ms
    );
  });

  it('should wrap an exact multiple of the interval to zero', () => {
    expect(wrapHourlyStartTime(new Duration({ hours: 2 }).ms, interval)).toBe(0);
    expect(wrapHourlyStartTime(new Duration({ hours: -2 }).ms, interval)).toBe(0);
  });
});

describe('wrapHourlyExceptionStartTimes', () => {
  const timeWindow = new Duration({ hours: 2 });

  it('should wrap start times that were shifted out of the time window', () => {
    expect(
      wrapHourlyExceptionStartTimes(
        [
          { key: 'a', occurrence_index: 0, start_time: { value: new Duration({ hours: 2 }).ms } },
          {
            key: 'b',
            occurrence_index: 1,
            start_time: { value: new Duration({ hours: 2, minutes: 58 }).ms },
          },
          {
            key: 'c',
            occurrence_index: 2,
            start_time: { value: new Duration({ minutes: -2 }).ms },
          },
        ],
        timeWindow
      )
    ).toEqual([
      { key: 'a', occurrence_index: 0, start_time: { value: 0 } },
      { key: 'b', occurrence_index: 1, start_time: { value: new Duration({ minutes: 58 }).ms } },
      {
        key: 'c',
        occurrence_index: 2,
        start_time: { value: new Duration({ hours: 1, minutes: 58 }).ms },
      },
    ]);
  });

  it('should leave exceptions without a start time change untouched', () => {
    const exceptions = [{ key: 'a', occurrence_index: 0, disabled: true }];
    expect(wrapHourlyExceptionStartTimes(exceptions, timeWindow)).toEqual(exceptions);
  });
});
