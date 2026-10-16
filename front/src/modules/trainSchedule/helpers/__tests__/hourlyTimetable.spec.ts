import { describe, it, expect } from 'vitest';

import type { TrainScheduleResponse } from 'common/api/osrdEditoastApi';
import { Duration } from 'utils/duration';

import {
  computeHourlyTimetableDuration,
  DEFAULT_HOURLY_TIMETABLE_DURATION,
  isStartTimeWithinInterval,
  wrapStartTimeToInterval,
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

describe('isStartTimeWithinInterval', () => {
  const interval = new Duration({ minutes: 30 });

  it('should accept a start time in [0, interval)', () => {
    expect(isStartTimeWithinInterval(Duration.zero, interval)).toBe(true);
    expect(isStartTimeWithinInterval(new Duration({ minutes: 29 }), interval)).toBe(true);
  });

  it('should reject a negative start time or one reaching the interval', () => {
    expect(isStartTimeWithinInterval(new Duration({ minutes: -1 }), interval)).toBe(false);
    expect(isStartTimeWithinInterval(interval, interval)).toBe(false);
  });
});

describe('wrapStartTimeToInterval', () => {
  const interval = new Duration({ minutes: 30 });

  it('should keep a start time already within the interval', () => {
    expect(wrapStartTimeToInterval(new Duration({ minutes: 10 }), interval)).toEqual(
      new Duration({ minutes: 10 })
    );
  });

  it('should take a start time past the interval modulo the interval', () => {
    expect(wrapStartTimeToInterval(new Duration({ minutes: 70 }), interval)).toEqual(
      new Duration({ minutes: 10 })
    );
    expect(wrapStartTimeToInterval(interval, interval)).toEqual(Duration.zero);
  });

  it('should bring a negative start time back into the interval', () => {
    expect(wrapStartTimeToInterval(new Duration({ minutes: -5 }), interval)).toEqual(
      new Duration({ minutes: 25 })
    );
  });
});
