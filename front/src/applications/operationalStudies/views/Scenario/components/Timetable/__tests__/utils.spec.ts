import { describe, it, expect } from 'vitest';

import type { RoundTrips, TrainScheduleResponse } from 'common/api/osrdEditoastApi';

import { buildTimetableExportPayload } from '../utils';

const buildTrainSchedule = (id: number): TrainScheduleResponse =>
  ({
    id,
    train_name: `TrainSchedule ${id}`,
  }) as TrainScheduleResponse;

describe('buildTimetableExportPayload', () => {
  it('includes forced one-way round trips for selected train schedules', () => {
    const trainSchedules = [buildTrainSchedule(12)];
    const roundTrips: RoundTrips = { one_ways: [12], round_trips: [] };

    const payload = buildTimetableExportPayload(trainSchedules, [12], roundTrips);

    expect(payload.round_trips).toEqual([[0, null]]);
  });

  it('includes round trip indexes only when both directions are selected', () => {
    const trainA = buildTrainSchedule(21);
    const trainB = buildTrainSchedule(42);
    const roundTrips: RoundTrips = { round_trips: [[21, 42]] };

    const payloadWithBoth = buildTimetableExportPayload([trainA, trainB], [21, 42], roundTrips);
    expect(payloadWithBoth.round_trips).toEqual([[0, 1]]);

    const payloadWithSingle = buildTimetableExportPayload([trainA], [21], roundTrips);
    expect(payloadWithSingle.round_trips).toBeUndefined();
  });

  it('handles train schedule one-ways', () => {
    const trainSchedule = buildTrainSchedule(7);
    const payload = buildTimetableExportPayload([trainSchedule], [7], {
      one_ways: [7],
    });

    expect(payload.round_trips).toEqual([[0, null]]);
  });
});
