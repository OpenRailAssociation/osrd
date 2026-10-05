import { describe, it, expect } from 'vitest';

import type { TrainScheduleResponse } from 'common/api/osrdEditoastApi';
import { Duration } from 'utils/duration';

import {
  computeDefaultHourlyPacedTrainTimeWindow,
  computeHourlyTimetableDuration,
  DEFAULT_HOURLY_TIMETABLE_DURATION,
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

describe('computeDefaultHourlyPacedTrainTimeWindow', () => {
  it('should return the timetable duration when it is a multiple of the interval', () => {
    expect(
      computeDefaultHourlyPacedTrainTimeWindow(
        new Duration({ hours: 2 }),
        new Duration({ minutes: 30 })
      )
    ).toEqual(new Duration({ hours: 2 }));
  });

  it('should return the interval when it is a multiple of the timetable duration', () => {
    expect(
      computeDefaultHourlyPacedTrainTimeWindow(
        new Duration({ hours: 2 }),
        new Duration({ hours: 4 })
      )
    ).toEqual(new Duration({ hours: 4 }));
  });

  it('should compute the LCM of the timetable duration and the interval (2h and 45min -> 6h)', () => {
    expect(
      computeDefaultHourlyPacedTrainTimeWindow(
        new Duration({ hours: 2 }),
        new Duration({ minutes: 45 })
      )
    ).toEqual(new Duration({ hours: 6 }));
  });
});

describe('wrapHourlyStartTime', () => {
  const paced = { interval: 'PT30M', time_window: 'PT2H' };

  describe('for a paced train', () => {
    it('should return undefined for a start time in [0, interval)', () => {
      expect(wrapHourlyStartTime(Duration.zero, paced, false)).toBeUndefined();
      expect(wrapHourlyStartTime(new Duration({ minutes: 29 }), paced, false)).toBeUndefined();
    });

    it('should take a start time reaching or past the interval modulo the interval', () => {
      expect(wrapHourlyStartTime(new Duration({ minutes: 30 }), paced, false)).toEqual(
        Duration.zero
      );
      expect(wrapHourlyStartTime(new Duration({ minutes: 70 }), paced, false)).toEqual(
        new Duration({ minutes: 10 })
      );
    });

    it('should bring a negative start time back into the interval', () => {
      expect(wrapHourlyStartTime(new Duration({ minutes: -5 }), paced, false)).toEqual(
        new Duration({ minutes: 25 })
      );
    });
  });

  describe('for an occurrence', () => {
    it('should return undefined for a start time in [0, time_window), even past the interval', () => {
      expect(wrapHourlyStartTime(new Duration({ minutes: 70 }), paced, true)).toBeUndefined();
    });

    it('should take a start time reaching or past the time window modulo the time window', () => {
      expect(wrapHourlyStartTime(new Duration({ hours: 2 }), paced, true)).toEqual(Duration.zero);
      expect(wrapHourlyStartTime(new Duration({ minutes: 130 }), paced, true)).toEqual(
        new Duration({ minutes: 10 })
      );
    });

    it('should bring a negative start time back into the time window', () => {
      expect(wrapHourlyStartTime(new Duration({ minutes: -5 }), paced, true)).toEqual(
        new Duration({ minutes: 115 })
      );
    });
  });
});
