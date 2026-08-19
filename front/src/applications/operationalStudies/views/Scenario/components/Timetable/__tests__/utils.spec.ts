import { describe, it, expect } from 'vitest';

import type { RoundTrips, TrainScheduleResponse } from 'common/api/osrdEditoastApi';
import { Duration } from 'utils/duration';
import { mapBy } from 'utils/types';

import { buildTimetableExportPayload, computeLatestMidnight } from '../utils';

const buildTrainSchedule = (id: number): TrainScheduleResponse =>
  ({
    id,
    train_name: `TrainSchedule ${id}`,
  }) as TrainScheduleResponse;

describe('buildTimetableExportPayload', () => {
  it('includes forced one-way round trips for selected train schedules', () => {
    const trainSchedules = mapBy([buildTrainSchedule(12)], 'id');
    const roundTrips: RoundTrips = { one_ways: [12], round_trips: [] };

    const payload = buildTimetableExportPayload(trainSchedules, [12], roundTrips);

    expect(payload.round_trips).toEqual([[0, null]]);
  });

  it('includes round trip indexes only when both directions are selected', () => {
    const trainA = buildTrainSchedule(21);
    const trainB = buildTrainSchedule(42);
    const roundTrips: RoundTrips = { round_trips: [[21, 42]] };

    const payloadWithBoth = buildTimetableExportPayload(
      mapBy([trainA, trainB], 'id'),
      [21, 42],
      roundTrips
    );
    expect(payloadWithBoth.round_trips).toEqual([[0, 1]]);

    const payloadWithSingle = buildTimetableExportPayload(mapBy([trainA], 'id'), [21], roundTrips);
    expect(payloadWithSingle.round_trips).toBeUndefined();
  });

  it('handles train schedule one-ways', () => {
    const trainSchedules = mapBy([buildTrainSchedule(7)], 'id');
    const payload = buildTimetableExportPayload(trainSchedules, [7], {
      one_ways: [7],
    });

    expect(payload.round_trips).toEqual([[0, null]]);
  });
});

const buildTrainScheduleWithStartTime = (
  id: number,
  startTime: Date,
  interval?: Duration,
  timeWindow?: Duration,
  exceptionsStartTimes?: Date[]
): TrainScheduleResponse => ({
  id,
  train_schedule_set_id: 1,
  constraint_distribution: 'STANDARD',
  path: [],
  rolling_stock_name: '',
  start_time: +startTime,
  train_name: '',
  paced:
    interval && timeWindow
      ? {
          interval: interval.toISOString(),
          time_window: timeWindow.toISOString(),
          exceptions:
            exceptionsStartTimes?.map((exceptionStartTime, idx) => ({
              id: idx,
              key: `${idx}`,
              start_time: { value: +exceptionStartTime },
            })) ?? [],
        }
      : undefined,
});

describe('computeLatestMidnight', () => {
  it('should return midnight from today if there is no train schedules given', () => {
    const now = new Date(2026, 7, 4, 16, 43, 19, 444);
    const result = computeLatestMidnight([], now);

    expect(result).toEqual(new Date(2026, 7, 4, 0, 0, 0, 0));
  });

  it('should return midnight from the latest occurrence of a timetable with a service', () => {
    const now = new Date(2026, 7, 4, 16, 43, 19, 444);

    const result = computeLatestMidnight(
      [
        buildTrainScheduleWithStartTime(1, new Date(2026, 6, 29, 14, 12, 0, 0)),
        buildTrainScheduleWithStartTime(
          2,
          new Date(2026, 6, 30, 9, 24, 0, 0),
          new Duration({ hours: 12 }),
          new Duration({ hours: 72 })
        ),
      ],
      now
    );

    expect(result).toEqual(new Date(2026, 7, 1, 0, 0, 0, 0));
  });

  it('should return midnight from the latest exception or occurrence', () => {
    const now = new Date(2026, 7, 4, 17, 57, 15, 555);

    const result = computeLatestMidnight(
      [
        buildTrainScheduleWithStartTime(
          1,
          new Date(2026, 6, 30, 9, 24, 0, 0),
          new Duration({ hours: 12 }),
          new Duration({ hours: 72 }),
          [new Date(2026, 7, 3, 9, 24, 0, 0)]
        ),
      ],
      now
    );

    expect(result).toEqual(new Date(2026, 7, 3, 0, 0, 0, 0));
  });
});
